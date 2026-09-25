import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccionAuditoria, MedioPago, Prisma, TipoMovimiento } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfirmPasswordDto } from '../../common/dto/confirm-password.dto';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { UpdateMovimientoDto } from './dto/update-movimiento.dto';

export interface FinanzasDashboard {
  totales: { ingresos: number; egresos: number; balance: number };
  porCategoriaIngreso: { categoria: string; total: number }[];
  porCategoriaEgreso: { categoria: string; total: number }[];
  porDepartamento: {
    departamentoId: string;
    nombre: string;
    ingresos: number;
    egresos: number;
    balance: number;
  }[];
}

const MEDIO_PAGO_LABEL: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
};

const ACCION_LABEL: Record<AccionAuditoria, string> = {
  CREACION: 'Creación',
  EDICION: 'Edición',
  ELIMINACION: 'Eliminación',
};

/** Nombre que se muestra para movimientos sin departamento (finanzas general) en export/UI. */
export const DEPARTAMENTO_GENERAL_LABEL = 'General';

type MovimientoConCategoria = Prisma.MovimientoFinancieroGetPayload<{
  include: { categoria: true; departamento: true };
}>;

/**
 * Contrato de filtro por departamento, compartido por findAll/dashboard/exportar/logs:
 * sin parámetros = todo (general + todos los departamentos); `departamentoId` = solo ese
 * departamento; `general` = solo movimientos sin departamento. `departamentoId` tiene
 * prioridad si (por error de cliente) llegaran ambos.
 */
function filtroDepartamento(
  departamentoId?: string,
  general?: boolean,
): Prisma.MovimientoFinancieroWhereInput {
  if (departamentoId) return { departamentoId };
  if (general) return { departamentoId: null };
  return {};
}

@Injectable()
export class MovimientosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll(
    iglesiaId: string,
    from?: Date,
    to?: Date,
    tipo?: TipoMovimiento,
    departamentoId?: string,
    general?: boolean,
  ) {
    return this.prisma.movimientoFinanciero.findMany({
      where: {
        iglesiaId,
        ...(tipo ? { tipo } : {}),
        ...(from && to ? { fecha: { gte: from, lte: to } } : {}),
        ...filtroDepartamento(departamentoId, general),
      },
      include: {
        categoria: true,
        departamento: true,
        creadoPor: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async findOne(iglesiaId: string, id: string) {
    const movimiento = await this.prisma.movimientoFinanciero.findFirst({
      where: { id, iglesiaId },
      include: {
        categoria: true,
        departamento: true,
        creadoPor: { select: { nombre: true, apellido: true } },
      },
    });

    if (!movimiento) {
      throw new NotFoundException('Movimiento no encontrado');
    }

    return movimiento;
  }

  async create(iglesiaId: string, usuarioId: string, dto: CreateMovimientoDto) {
    const categoria = await this.categoriaDeLaIglesiaOrThrow(iglesiaId, dto.categoriaId, dto.departamentoId);

    const movimiento = await this.prisma.movimientoFinanciero.create({
      data: {
        tipo: categoria.tipo,
        monto: dto.monto,
        fecha: new Date(dto.fecha),
        descripcion: dto.descripcion,
        medioPago: dto.medioPago,
        categoriaId: categoria.id,
        departamentoId: dto.departamentoId ?? null,
        iglesiaId,
        creadoPorId: usuarioId,
      },
      include: {
        categoria: true,
        departamento: true,
        creadoPor: { select: { nombre: true, apellido: true } },
      },
    });

    await this.registrarAuditoria(iglesiaId, usuarioId, movimiento.id, AccionAuditoria.CREACION, movimiento);

    return movimiento;
  }

  async update(iglesiaId: string, id: string, usuarioId: string, dto: UpdateMovimientoDto) {
    const existente = await this.findOne(iglesiaId, id);

    // El departamento del movimiento es inmutable (ver UpdateMovimientoDto): si se cambia
    // la categoría, la nueva debe pertenecer al mismo destino (general o el mismo depto).
    const categoria = dto.categoriaId
      ? await this.categoriaDeLaIglesiaOrThrow(
          iglesiaId,
          dto.categoriaId,
          existente.departamentoId ?? undefined,
        )
      : undefined;

    const movimiento = await this.prisma.movimientoFinanciero.update({
      where: { id },
      data: {
        monto: dto.monto,
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
        descripcion: dto.descripcion,
        medioPago: dto.medioPago,
        categoriaId: categoria?.id,
        tipo: categoria?.tipo,
      },
      include: {
        categoria: true,
        departamento: true,
        creadoPor: { select: { nombre: true, apellido: true } },
      },
    });

    await this.registrarAuditoria(iglesiaId, usuarioId, movimiento.id, AccionAuditoria.EDICION, movimiento);

    return movimiento;
  }

  /** Exige confirmar la contraseña del usuario antes de eliminar: es una acción irreversible. */
  async remove(iglesiaId: string, id: string, usuarioId: string, dto: ConfirmPasswordDto): Promise<void> {
    await this.authService.verifyPassword(usuarioId, dto.password);

    const movimiento = await this.findOne(iglesiaId, id);
    await this.prisma.movimientoFinanciero.delete({ where: { id } });
    await this.registrarAuditoria(iglesiaId, usuarioId, id, AccionAuditoria.ELIMINACION, movimiento);
  }

  async logs(iglesiaId: string, departamentoId?: string, general?: boolean) {
    return this.prisma.movimientoAuditLog.findMany({
      where: {
        iglesiaId,
        ...(departamentoId ? { departamentoId } : {}),
        ...(general ? { departamentoId: null } : {}),
      },
      include: { usuario: { select: { nombre: true, apellido: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Exporta el mismo set de logs que `logs()` a un .xlsx — por departamento (departamentoId),
   * de finanzas general (general) o consolidado de toda la iglesia (sin filtro). Los datos del
   * movimiento salen del `snapshot` congelado en el log, nunca del movimiento en vivo: si el
   * movimiento fue editado o eliminado después, el log debe reflejar el estado de ese momento.
   */
  async exportarLogs(iglesiaId: string, departamentoId?: string, general?: boolean): Promise<Buffer> {
    const logs = await this.logs(iglesiaId, departamentoId, general);
    const esConsolidado = !departamentoId && !general;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Logs de auditoría');

    sheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 18 },
      { header: 'Acción', key: 'accion', width: 12 },
      { header: 'Usuario', key: 'usuario', width: 24 },
      { header: 'Departamento', key: 'departamento', width: 20 },
      { header: 'Tipo', key: 'tipo', width: 12 },
      { header: 'Categoría', key: 'categoria', width: 24 },
      { header: 'Monto', key: 'monto', width: 16 },
      { header: 'Descripción', key: 'descripcion', width: 34 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getColumn('monto').numFmt = '#,##0';

    for (const log of logs) {
      const snapshot = log.snapshot as {
        tipo: TipoMovimiento;
        monto: number;
        descripcion: string;
        categoria: string;
        departamento: string | null;
      };

      sheet.addRow({
        fecha: log.createdAt.toLocaleString('es-CL'),
        accion: ACCION_LABEL[log.accion],
        usuario: log.usuario ? `${log.usuario.nombre} ${log.usuario.apellido}` : 'Usuario eliminado',
        departamento: snapshot.departamento ?? DEPARTAMENTO_GENERAL_LABEL,
        tipo: snapshot.tipo === TipoMovimiento.INGRESO ? 'Ingreso' : 'Egreso',
        categoria: snapshot.categoria,
        monto: snapshot.monto,
        descripcion: snapshot.descripcion,
      });
    }

    sheet.addRow({});
    const filaResumen = sheet.addRow({
      accion: esConsolidado ? 'Consolidado — todos los departamentos' : 'Filtrado por destino',
      categoria: `Total de registros: ${logs.length}`,
    });
    filaResumen.font = { italic: true, bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async dashboard(
    iglesiaId: string,
    from?: Date,
    to?: Date,
    departamentoId?: string,
    general?: boolean,
  ): Promise<FinanzasDashboard> {
    const movimientos = await this.prisma.movimientoFinanciero.findMany({
      where: {
        iglesiaId,
        ...(from && to ? { fecha: { gte: from, lte: to } } : {}),
        ...filtroDepartamento(departamentoId, general),
      },
      include: { categoria: true, departamento: true },
    });

    const ingresos = movimientos.filter((m) => m.tipo === TipoMovimiento.INGRESO);
    const egresos = movimientos.filter((m) => m.tipo === TipoMovimiento.EGRESO);

    const totalIngresos = ingresos.reduce((suma, m) => suma + Number(m.monto), 0);
    const totalEgresos = egresos.reduce((suma, m) => suma + Number(m.monto), 0);

    return {
      // Suma de todo lo que cayó en el filtro (general + departamentos si no se filtró):
      // es plata de la misma iglesia. El desglose por departamento es informativo,
      // no un balance aislado por sub-libro.
      totales: { ingresos: totalIngresos, egresos: totalEgresos, balance: totalIngresos - totalEgresos },
      porCategoriaIngreso: this.agruparPorCategoria(ingresos),
      porCategoriaEgreso: this.agruparPorCategoria(egresos),
      porDepartamento: this.agruparPorDepartamento(movimientos),
    };
  }

  async exportar(
    iglesiaId: string,
    from?: Date,
    to?: Date,
    departamentoId?: string,
    general?: boolean,
  ): Promise<Buffer> {
    const movimientos = await this.findAll(iglesiaId, from, to, undefined, departamentoId, general);
    // Solo cuando no se filtró por un destino específico tiene sentido mostrar
    // subtotales por departamento (si ya se filtró, todas las filas son del mismo destino).
    const esConsolidado = !departamentoId && !general;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Movimientos');

    sheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Tipo', key: 'tipo', width: 12 },
      { header: 'Categoría', key: 'categoria', width: 24 },
      { header: 'Departamento', key: 'departamento', width: 20 },
      { header: 'Medio de pago', key: 'medioPago', width: 16 },
      { header: 'Monto', key: 'monto', width: 16 },
      { header: 'Descripción', key: 'descripcion', width: 34 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getColumn('monto').numFmt = '#,##0';

    let totalIngresos = 0;
    let totalEgresos = 0;
    const porDepartamento = new Map<string, { ingresos: number; egresos: number }>();

    for (const m of movimientos) {
      const monto = Number(m.monto);
      const nombreDepartamento = m.departamento?.nombre ?? DEPARTAMENTO_GENERAL_LABEL;

      if (m.tipo === TipoMovimiento.INGRESO) totalIngresos += monto;
      else totalEgresos += monto;

      const acumulado = porDepartamento.get(nombreDepartamento) ?? { ingresos: 0, egresos: 0 };
      if (m.tipo === TipoMovimiento.INGRESO) acumulado.ingresos += monto;
      else acumulado.egresos += monto;
      porDepartamento.set(nombreDepartamento, acumulado);

      sheet.addRow({
        fecha: m.fecha.toLocaleDateString('es-CL'),
        tipo: m.tipo === TipoMovimiento.INGRESO ? 'Ingreso' : 'Egreso',
        categoria: m.categoria.nombre,
        departamento: nombreDepartamento,
        medioPago: MEDIO_PAGO_LABEL[m.medioPago],
        monto,
        descripcion: m.descripcion,
      });
    }

    sheet.addRow({});

    if (esConsolidado && porDepartamento.size > 0) {
      const filaTitulo = sheet.addRow({ categoria: 'Subtotales por departamento' });
      filaTitulo.font = { bold: true, italic: true };

      for (const [nombre, { ingresos, egresos }] of [...porDepartamento.entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      )) {
        sheet.addRow({ departamento: nombre, categoria: 'Ingresos', monto: ingresos });
        sheet.addRow({ departamento: nombre, categoria: 'Egresos', monto: egresos });
        sheet.addRow({ departamento: nombre, categoria: 'Balance', monto: ingresos - egresos });
      }

      sheet.addRow({});
    }

    const filaIngresos = sheet.addRow({ categoria: 'Total ingresos', monto: totalIngresos });
    const filaEgresos = sheet.addRow({ categoria: 'Total egresos', monto: totalEgresos });
    const filaBalance = sheet.addRow({ categoria: 'Balance', monto: totalIngresos - totalEgresos });
    [filaIngresos, filaEgresos, filaBalance].forEach((fila) => (fila.font = { bold: true }));

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private agruparPorCategoria(
    movimientos: { categoria: { nombre: string }; monto: unknown }[],
  ): { categoria: string; total: number }[] {
    const totales = new Map<string, number>();

    for (const m of movimientos) {
      const actual = totales.get(m.categoria.nombre) ?? 0;
      totales.set(m.categoria.nombre, actual + Number(m.monto));
    }

    return [...totales.entries()]
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);
  }

  private agruparPorDepartamento(
    movimientos: {
      departamento: { id: string; nombre: string } | null;
      tipo: TipoMovimiento;
      monto: unknown;
    }[],
  ): { departamentoId: string; nombre: string; ingresos: number; egresos: number; balance: number }[] {
    const totales = new Map<string, { nombre: string; ingresos: number; egresos: number }>();

    for (const m of movimientos) {
      if (!m.departamento) continue; // el desglose por departamento no incluye finanzas general

      const actual = totales.get(m.departamento.id) ?? {
        nombre: m.departamento.nombre,
        ingresos: 0,
        egresos: 0,
      };
      if (m.tipo === TipoMovimiento.INGRESO) actual.ingresos += Number(m.monto);
      else actual.egresos += Number(m.monto);
      totales.set(m.departamento.id, actual);
    }

    return [...totales.entries()]
      .map(([departamentoId, { nombre, ingresos, egresos }]) => ({
        departamentoId,
        nombre,
        ingresos,
        egresos,
        balance: ingresos - egresos,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /**
   * Valida que la categoría sea de la iglesia y pertenezca al mismo destino que el
   * movimiento (general o el departamento indicado) — una categoría de "Música" no
   * sirve para un movimiento general ni de otro departamento.
   */
  private async categoriaDeLaIglesiaOrThrow(iglesiaId: string, categoriaId: string, departamentoId?: string) {
    if (departamentoId) {
      await this.departamentoActivoDeLaIglesiaOrThrow(iglesiaId, departamentoId);
    }

    const categoria = await this.prisma.categoriaFinanciera.findFirst({
      where: { id: categoriaId, iglesiaId },
    });

    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada');
    }

    if ((categoria.departamentoId ?? undefined) !== (departamentoId ?? undefined)) {
      throw new ConflictException('La categoría no pertenece a ese departamento');
    }

    return categoria;
  }

  /** Reusado por FinanzasImportService para validar el destino de una importación masiva. */
  async departamentoActivoDeLaIglesiaOrThrow(iglesiaId: string, departamentoId: string) {
    const departamento = await this.prisma.departamentoFinanciero.findFirst({
      where: { id: departamentoId, iglesiaId },
    });

    if (!departamento) {
      throw new NotFoundException('Departamento no encontrado');
    }
    if (!departamento.activo) {
      throw new ConflictException(
        'El departamento está archivado; no se pueden registrar movimientos nuevos en él',
      );
    }

    return departamento;
  }

  private async registrarAuditoria(
    iglesiaId: string,
    usuarioId: string,
    movimientoId: string,
    accion: AccionAuditoria,
    movimiento: MovimientoConCategoria,
  ): Promise<void> {
    await this.prisma.movimientoAuditLog.create({
      data: {
        iglesiaId,
        usuarioId,
        movimientoId,
        departamentoId: movimiento.departamentoId,
        accion,
        snapshot: {
          tipo: movimiento.tipo,
          monto: Number(movimiento.monto),
          descripcion: movimiento.descripcion,
          medioPago: movimiento.medioPago,
          fecha: movimiento.fecha.toISOString(),
          categoria: movimiento.categoria.nombre,
          departamento: movimiento.departamento?.nombre ?? null,
        },
      },
    });
  }
}
