import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AccionAuditoria, MedioPago, TipoMovimiento } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';
import { MovimientosService } from './movimientos.service';

/**
 * Orden y texto exactos esperados en la fila 1 de la plantilla (ver prompt.md).
 * Exportada porque también la usa `plantilla()` para generar el archivo real que se
 * descarga — así los headers que se validan y los que se sirven nunca pueden desincronizarse.
 */
export const HEADERS = ['Fecha', 'Tipo', 'Categoría', 'Medio de pago', 'Monto', 'Descripción'] as const;

/** Evita abuso/timeouts en una importación con un archivo desmedido. */
const MAX_FILAS = 2000;

/** Mismo tope que CreateMovimientoDto (columna `monto` es Decimal(12,2)). */
const MONTO_MAX = 9999999999.99;
const MONTO_MIN = 0.01;

interface ErrorFila {
  fila: number;
  mensaje: string;
}

interface FilaCruda {
  fila: number;
  fecha: ExcelJS.CellValue;
  tipo: ExcelJS.CellValue;
  categoria: ExcelJS.CellValue;
  medioPago: ExcelJS.CellValue;
  monto: ExcelJS.CellValue;
  descripcion: ExcelJS.CellValue;
}

interface FilaValidada {
  fila: number;
  fecha: Date;
  tipo: TipoMovimiento;
  categoriaNombre: string;
  medioPago: MedioPago;
  monto: number;
  descripcion: string;
}

export interface ResultadoImportacion {
  importados: number;
  categoriasCreadas: string[];
}

@Injectable()
export class FinanzasImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movimientosService: MovimientosService,
  ) {}

  async importar(
    iglesiaId: string,
    usuarioId: string,
    departamentoId: string | undefined,
    archivo: Express.Multer.File,
  ): Promise<ResultadoImportacion> {
    // Falla rápido si el destino no existe o está archivado, antes de parsear el archivo.
    const departamento = departamentoId
      ? await this.movimientosService.departamentoActivoDeLaIglesiaOrThrow(iglesiaId, departamentoId)
      : null;

    const worksheet = await this.leerHoja(archivo);
    const { filas, erroresEncabezado } = this.extraerFilas(worksheet);
    if (erroresEncabezado.length > 0) {
      throw new UnprocessableEntityException({ errores: erroresEncabezado });
    }

    if (filas.length === 0) {
      throw new UnprocessableEntityException({
        errores: [{ fila: 1, mensaje: 'El archivo no tiene filas de datos' }],
      });
    }
    if (filas.length > MAX_FILAS) {
      throw new UnprocessableEntityException({
        errores: [{ fila: 1, mensaje: `El archivo supera el máximo de ${MAX_FILAS} filas por importación` }],
      });
    }

    const { validas, errores } = this.validarFilas(filas);
    if (errores.length > 0) {
      // Todo o nada: si hay al menos un error, no se toca la base de datos.
      throw new UnprocessableEntityException({ errores });
    }

    return this.persistir(iglesiaId, usuarioId, departamentoId, departamento?.nombre ?? null, validas);
  }

  /**
   * Genera el archivo de plantilla real que el usuario descarga para importar. Deliberadamente
   * sin filas de ejemplo: si trajera filas ficticias y alguien olvida borrarlas antes de subir el
   * archivo real, se importarían como movimientos financieros reales (falla silenciosa).
   */
  async plantilla(formato: 'xlsx' | 'csv'): Promise<Buffer> {
    if (formato === 'csv') {
      return Buffer.from(`${HEADERS.join(',')}\n`, 'utf-8');
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Movimientos');

    sheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Tipo', key: 'tipo', width: 12 },
      { header: 'Categoría', key: 'categoria', width: 24 },
      { header: 'Medio de pago', key: 'medioPago', width: 16 },
      { header: 'Monto', key: 'monto', width: 16 },
      { header: 'Descripción', key: 'descripcion', width: 34 },
    ];
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async leerHoja(archivo: Express.Multer.File): Promise<ExcelJS.Worksheet> {
    const esCsv = archivo.mimetype.includes('csv') || /\.csv$/i.test(archivo.originalname);

    if (esCsv) {
      const workbook = new ExcelJS.Workbook();
      return workbook.csv.read(Readable.from(archivo.buffer));
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(archivo.buffer as unknown as ExcelJS.Buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new UnprocessableEntityException({
        errores: [{ fila: 1, mensaje: 'El archivo no contiene ninguna hoja' }],
      });
    }
    return worksheet;
  }

  private extraerFilas(worksheet: ExcelJS.Worksheet): { filas: FilaCruda[]; erroresEncabezado: ErrorFila[] } {
    const encabezado = worksheet.getRow(1).values as ExcelJS.CellValue[];
    // .values de ExcelJS es 1-indexado (índice 0 queda vacío), por eso el +1.
    const encabezadoValido = HEADERS.every(
      (esperado, i) => this.celdaComoTexto(encabezado?.[i + 1]) === esperado,
    );

    if (!encabezadoValido) {
      return {
        filas: [],
        erroresEncabezado: [
          { fila: 1, mensaje: `Encabezados inválidos. Deben ser exactamente: ${HEADERS.join(' | ')}` },
        ],
      };
    }

    const filas: FilaCruda[] = [];
    worksheet.eachRow((row, numeroFila) => {
      if (numeroFila === 1) return;

      const valores = row.values as ExcelJS.CellValue[];
      const filaVacia = [1, 2, 3, 4, 5, 6].every((i) => this.celdaComoTexto(valores?.[i]) === '');
      if (filaVacia) return; // ignora filas completamente vacías (ej. al final del archivo)

      filas.push({
        fila: numeroFila,
        fecha: valores?.[1],
        tipo: valores?.[2],
        categoria: valores?.[3],
        medioPago: valores?.[4],
        monto: valores?.[5],
        descripcion: valores?.[6],
      });
    });

    return { filas, erroresEncabezado: [] };
  }

  private validarFilas(filas: FilaCruda[]): { validas: FilaValidada[]; errores: ErrorFila[] } {
    const validas: FilaValidada[] = [];
    const errores: ErrorFila[] = [];

    for (const cruda of filas) {
      const erroresFila: string[] = [];

      const fecha = this.parsearFecha(cruda.fecha);
      if (!fecha) erroresFila.push('Fecha inválida (formato esperado DD-MM-AAAA)');

      const tipo = this.parsearTipo(cruda.tipo);
      if (!tipo) erroresFila.push('Tipo inválido (debe ser "Ingreso" o "Egreso")');

      const categoriaNombre = this.celdaComoTexto(cruda.categoria);
      if (!categoriaNombre) erroresFila.push('Categoría vacía');

      const medioPago = this.parsearMedioPago(cruda.medioPago);
      if (!medioPago) erroresFila.push('Medio de pago inválido (debe ser "Efectivo" o "Transferencia")');

      const monto = this.parsearMonto(cruda.monto);
      if (monto === null) {
        erroresFila.push(
          'Monto inválido (debe ser numérico, mayor a 0, sin símbolo de moneda ni separador de miles, hasta 2 decimales)',
        );
      }

      const descripcion = this.celdaComoTexto(cruda.descripcion);
      if (!descripcion) erroresFila.push('Descripción vacía');

      if (erroresFila.length > 0) {
        errores.push({ fila: cruda.fila, mensaje: erroresFila.join('; ') });
        continue;
      }

      validas.push({
        fila: cruda.fila,
        fecha: fecha as Date,
        tipo: tipo as TipoMovimiento,
        categoriaNombre,
        medioPago: medioPago as MedioPago,
        monto: monto as number,
        descripcion,
      });
    }

    return { validas, errores };
  }

  /**
   * Crea todos los movimientos (más su MovimientoAuditLog) dentro de una única
   * transacción: si algo falla a mitad de camino, no queda el libro a medias.
   * Timeout extendido porque, en el peor caso, son hasta MAX_FILAS filas
   * secuenciales (categoría a resolver + movimiento + log, uno por fila).
   */
  private async persistir(
    iglesiaId: string,
    usuarioId: string,
    departamentoId: string | undefined,
    departamentoNombre: string | null,
    filas: FilaValidada[],
  ): Promise<ResultadoImportacion> {
    return this.prisma.withTenantTransaction(
      async (tx) => {
        const categoriasExistentes = await tx.categoriaFinanciera.findMany({
          where: { iglesiaId, departamentoId: departamentoId ?? null },
        });

        const mapaCategoriaId = new Map<string, string>();
        for (const categoria of categoriasExistentes) {
          mapaCategoriaId.set(this.claveCategoria(categoria.nombre, categoria.tipo), categoria.id);
        }

        const categoriasCreadas: string[] = [];
        let importados = 0;

        // Secuencial (no Promise.all): si dos filas del mismo archivo comparten un
        // nombre de categoría todavía no existente, evita que ambas intenten crearla
        // a la vez y choquen contra el unique constraint.
        for (const fila of filas) {
          const clave = this.claveCategoria(fila.categoriaNombre, fila.tipo);
          let categoriaId = mapaCategoriaId.get(clave);

          if (!categoriaId) {
            const nueva = await tx.categoriaFinanciera.create({
              data: {
                nombre: fila.categoriaNombre,
                tipo: fila.tipo,
                iglesiaId,
                departamentoId: departamentoId ?? null,
              },
            });
            categoriaId = nueva.id;
            mapaCategoriaId.set(clave, categoriaId);
            categoriasCreadas.push(fila.categoriaNombre);
          }

          const movimiento = await tx.movimientoFinanciero.create({
            data: {
              tipo: fila.tipo,
              monto: fila.monto,
              fecha: fila.fecha,
              descripcion: fila.descripcion,
              medioPago: fila.medioPago,
              categoriaId,
              departamentoId: departamentoId ?? null,
              iglesiaId,
              creadoPorId: usuarioId,
            },
          });

          await tx.movimientoAuditLog.create({
            data: {
              iglesiaId,
              usuarioId,
              movimientoId: movimiento.id,
              departamentoId: departamentoId ?? null,
              accion: AccionAuditoria.CREACION,
              snapshot: {
                tipo: movimiento.tipo,
                monto: Number(movimiento.monto),
                descripcion: movimiento.descripcion,
                medioPago: movimiento.medioPago,
                fecha: movimiento.fecha.toISOString(),
                categoria: fila.categoriaNombre,
                departamento: departamentoNombre,
                origen: 'importacion',
              },
            },
          });

          importados += 1;
        }

        return { importados, categoriasCreadas };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  }

  private claveCategoria(nombre: string, tipo: TipoMovimiento): string {
    return `${nombre.trim().toLowerCase()}|${tipo}`;
  }

  private celdaComoTexto(valor: ExcelJS.CellValue | undefined): string {
    if (valor === null || valor === undefined) return '';
    if (valor instanceof Date) return valor.toISOString();

    if (typeof valor === 'object') {
      if ('richText' in valor) {
        return valor.richText
          .map((r) => r.text)
          .join('')
          .trim();
      }
      if ('text' in valor) {
        return String(valor.text ?? '').trim();
      }
      // Fórmulas, errores de celda u otros objetos que esta plantilla no soporta: se
      // tratan como celda vacía (la fila fallará su validación correspondiente, ej.
      // "Categoría vacía") en vez de mostrar el "[object Object]" de un String() crudo.
      return '';
    }

    return String(valor).trim();
  }

  private parsearFecha(valor: ExcelJS.CellValue | undefined): Date | null {
    if (valor instanceof Date) return valor;

    const texto = this.celdaComoTexto(valor);
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(texto);
    if (!match) return null;

    const [, diaStr, mesStr, anioStr] = match;
    const dia = Number(diaStr);
    const mes = Number(mesStr);
    const anio = Number(anioStr);
    const fecha = new Date(anio, mes - 1, dia);

    // new Date() "desborda" fechas inválidas (ej. 31-02-2026 -> 03-03-2026) en vez de fallar.
    const esValida = fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
    return esValida ? fecha : null;
  }

  private parsearTipo(valor: ExcelJS.CellValue | undefined): TipoMovimiento | null {
    const texto = this.celdaComoTexto(valor).toLowerCase();
    if (texto === 'ingreso') return TipoMovimiento.INGRESO;
    if (texto === 'egreso') return TipoMovimiento.EGRESO;
    return null;
  }

  private parsearMedioPago(valor: ExcelJS.CellValue | undefined): MedioPago | null {
    const texto = this.celdaComoTexto(valor).toLowerCase();
    if (texto === 'efectivo') return MedioPago.EFECTIVO;
    if (texto === 'transferencia') return MedioPago.TRANSFERENCIA;
    return null;
  }

  /**
   * No acepta separador de miles ni símbolo de moneda: solo dígitos y, opcional, un punto
   * decimal con hasta 2 dígitos (mismo criterio para celdas numéricas de Excel que para
   * texto de CSV — `String(numero)` en JS produce la representación decimal más corta que
   * redondea de vuelta al mismo valor, sin artefactos de punto flotante para estos montos).
   */
  private parsearMonto(valor: ExcelJS.CellValue | undefined): number | null {
    const texto = typeof valor === 'number' ? String(valor) : this.celdaComoTexto(valor);
    if (!/^\d+(\.\d{1,2})?$/.test(texto)) return null;

    const numero = Number(texto);
    return this.montoDentroDeLimites(numero) ? numero : null;
  }

  private montoDentroDeLimites(numero: number): boolean {
    return Number.isFinite(numero) && numero >= MONTO_MIN && numero <= MONTO_MAX;
  }
}
