import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TipoMovimiento } from '@prisma/client';
import { translateUniqueConstraintError } from '../../common/utils/translate-unique-constraint-error';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Contrato de filtro (igual al de movimientos, ver MovimientosService.findAll):
   * sin parámetros = todas (general + todos los departamentos);
   * `departamentoId` = solo las de ese departamento; `general=true` = solo las sin departamento.
   */
  async findAll(iglesiaId: string, tipo?: TipoMovimiento, departamentoId?: string, general?: boolean) {
    return this.prisma.categoriaFinanciera.findMany({
      where: {
        iglesiaId,
        ...(tipo ? { tipo } : {}),
        ...(departamentoId ? { departamentoId } : {}),
        ...(general ? { departamentoId: null } : {}),
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(iglesiaId: string, dto: CreateCategoriaDto) {
    if (dto.departamentoId) {
      await this.departamentoActivoDeLaIglesiaOrThrow(iglesiaId, dto.departamentoId);
    }

    // El @@unique([iglesiaId, departamentoId, nombre, tipo]) del schema no basta cuando
    // departamentoId es NULL: en Postgres NULL != NULL, así que el índice único no detecta
    // dos categorías "generales" duplicadas. Se valida acá en la capa de aplicación
    // (concurrencia baja: un usuario creando una categoría desde un formulario).
    const duplicada = await this.prisma.categoriaFinanciera.findFirst({
      where: { iglesiaId, departamentoId: dto.departamentoId ?? null, nombre: dto.nombre, tipo: dto.tipo },
    });
    if (duplicada) {
      throw new ConflictException('Ya existe una categoría con ese nombre para ese tipo');
    }

    try {
      return await this.prisma.categoriaFinanciera.create({
        data: { nombre: dto.nombre, tipo: dto.tipo, iglesiaId, departamentoId: dto.departamentoId ?? null },
      });
    } catch (error) {
      throw translateUniqueConstraintError(error);
    }
  }

  private async departamentoActivoDeLaIglesiaOrThrow(iglesiaId: string, departamentoId: string) {
    const departamento = await this.prisma.departamentoFinanciero.findFirst({
      where: { id: departamentoId, iglesiaId },
    });

    if (!departamento) {
      throw new NotFoundException('Departamento no encontrado');
    }
    if (!departamento.activo) {
      throw new ConflictException(
        'El departamento está archivado; no se pueden crear categorías nuevas en él',
      );
    }

    return departamento;
  }
}
