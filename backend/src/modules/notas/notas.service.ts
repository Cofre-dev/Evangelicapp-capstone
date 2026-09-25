import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoTarea, TipoNota } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotaDto } from './dto/create-nota.dto';
import { UpdateNotaDto } from './dto/update-nota.dto';

const NOTA_INCLUDE = {
  creadoPor: { select: { nombre: true, apellido: true } },
  asignadoA: { select: { id: true, nombre: true, apellido: true } },
} as const;

@Injectable()
export class NotasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Vista completa del pastor: recordatorios y notas largas de toda la iglesia. */
  async findAll(iglesiaId: string, incluirArchivados: boolean) {
    return this.prisma.nota.findMany({
      where: { iglesiaId, ...(incluirArchivados ? {} : { archivado: false }) },
      include: NOTA_INCLUDE,
      orderBy: [{ fechaLimite: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /** Tareas activas asignadas a un tesorero/secretaria — lo único que ellos pueden ver. */
  async findMisTareas(iglesiaId: string, usuarioId: string) {
    return this.prisma.nota.findMany({
      where: {
        iglesiaId,
        asignadoAId: usuarioId,
        tipo: TipoNota.RECORDATORIO,
        estado: { not: EstadoTarea.COMPLETADA },
      },
      include: NOTA_INCLUDE,
      orderBy: [{ fechaLimite: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(iglesiaId: string, id: string) {
    const nota = await this.prisma.nota.findFirst({
      where: { id, iglesiaId },
      include: NOTA_INCLUDE,
    });

    if (!nota) {
      throw new NotFoundException('Nota no encontrada');
    }

    return nota;
  }

  async create(iglesiaId: string, usuarioId: string, dto: CreateNotaDto) {
    if (dto.asignadoAId) {
      await this.usuarioDeLaIglesiaOrThrow(iglesiaId, dto.asignadoAId);
    }

    return this.prisma.nota.create({
      data: {
        tipo: dto.tipo ?? TipoNota.RECORDATORIO,
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        fechaLimite: dto.fechaLimite ? new Date(dto.fechaLimite) : undefined,
        iglesiaId,
        creadoPorId: usuarioId,
        asignadoAId: dto.asignadoAId,
      },
      include: NOTA_INCLUDE,
    });
  }

  async update(iglesiaId: string, id: string, dto: UpdateNotaDto) {
    await this.findOne(iglesiaId, id);

    if (dto.asignadoAId) {
      await this.usuarioDeLaIglesiaOrThrow(iglesiaId, dto.asignadoAId);
    }

    return this.prisma.nota.update({
      where: { id },
      data: {
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        fechaLimite: dto.fechaLimite ? new Date(dto.fechaLimite) : undefined,
        asignadoAId: dto.asignadoAId === null ? null : dto.asignadoAId,
        estado: dto.estado,
      },
      include: NOTA_INCLUDE,
    });
  }

  /** El propio asignado marca su tarea como hecha; queda EN_REVISION hasta que el pastor la apruebe. */
  async marcarHecha(iglesiaId: string, usuarioId: string, id: string) {
    const nota = await this.prisma.nota.findFirst({ where: { id, iglesiaId, asignadoAId: usuarioId } });

    if (!nota) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (nota.estado !== EstadoTarea.PENDIENTE) {
      throw new ForbiddenException('Esta tarea ya fue marcada o completada');
    }

    return this.prisma.nota.update({
      where: { id },
      data: { estado: EstadoTarea.EN_REVISION },
      include: NOTA_INCLUDE,
    });
  }

  /** Solo se archiva lo COMPLETADA (aprobado por el pastor) — evita ocultar algo aún en revisión. */
  async archivar(iglesiaId: string, id: string) {
    const nota = await this.findOne(iglesiaId, id);

    if (nota.estado !== EstadoTarea.COMPLETADA) {
      throw new ForbiddenException('Solo se pueden archivar recordatorios completados');
    }

    return this.prisma.nota.update({
      where: { id },
      data: { archivado: true },
      include: NOTA_INCLUDE,
    });
  }

  async desarchivar(iglesiaId: string, id: string) {
    await this.findOne(iglesiaId, id);

    return this.prisma.nota.update({
      where: { id },
      data: { archivado: false },
      include: NOTA_INCLUDE,
    });
  }

  async remove(iglesiaId: string, id: string): Promise<void> {
    await this.findOne(iglesiaId, id);
    await this.prisma.nota.delete({ where: { id } });
  }

  private async usuarioDeLaIglesiaOrThrow(iglesiaId: string, usuarioId: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, iglesiaId },
      select: { id: true },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario asignado no encontrado');
    }

    return usuario;
  }
}
