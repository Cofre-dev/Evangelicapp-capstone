import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoConfirmacionPredicador } from '@prisma/client';
import { runAsService } from '../../common/context/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { REALTIME_EVENTS } from '../realtime/realtime-rooms.util';
import { RealtimeService } from '../realtime/realtime.service';

/**
 * Fase 8 de docs/supabase.md (RLS): toda la clase es la ruta pública por token (ver
 * PredicadoresController) — no hay identidad de Usuario, y el token de un solo uso ya es
 * la autorización real. Cada método público corre en `runAsService` (bypass explícito de
 * tenant), no en el contexto scoped que dejaría un guard.
 */
@Injectable()
export class PredicadoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /** Público: lo que ve el predicador al abrir el link del email. */
  async getInvitacion(token: string) {
    return runAsService(() => this.getInvitacionComoServicio(token));
  }

  private async getInvitacionComoServicio(token: string) {
    const predicador = await this.prisma.predicador.findUnique({
      where: { tokenConfirmacion: token },
      include: {
        evento: {
          select: {
            titulo: true,
            fechaInicio: true,
            fechaFin: true,
            ubicacion: true,
            iglesia: { select: { nombre: true, logoUrl: true } },
          },
        },
      },
    });

    if (!predicador) {
      throw new NotFoundException('Invitación no encontrada');
    }

    return {
      nombre: predicador.nombre,
      email: predicador.email,
      estado: predicador.estado,
      respondidoAt: predicador.respondidoAt,
      evento: {
        titulo: predicador.evento.titulo,
        fechaInicio: predicador.evento.fechaInicio,
        fechaFin: predicador.evento.fechaFin,
        ubicacion: predicador.evento.ubicacion,
      },
      iglesia: predicador.evento.iglesia,
    };
  }

  async responder(token: string, respuesta: 'CONFIRMADO' | 'RECHAZADO') {
    return runAsService(() => this.responderComoServicio(token, respuesta));
  }

  private async responderComoServicio(token: string, respuesta: 'CONFIRMADO' | 'RECHAZADO') {
    const predicador = await this.prisma.predicador.findUnique({
      where: { tokenConfirmacion: token },
      include: { evento: { select: { iglesiaId: true } } },
    });

    if (!predicador) {
      throw new NotFoundException('Invitación no encontrada');
    }

    // El link es de un solo uso: sin esto, cualquiera con el link podría alternar
    // CONFIRMADO/RECHAZADO indefinidamente después de la primera respuesta.
    if (predicador.estado !== EstadoConfirmacionPredicador.PENDIENTE) {
      throw new BadRequestException('Esta invitación ya fue respondida');
    }

    const respondidoAt = new Date();
    await this.prisma.predicador.update({
      where: { tokenConfirmacion: token },
      data: { estado: respuesta, respondidoAt },
    });

    // La pantalla de evento del Pastor (equipo de la iglesia) se entera en vivo,
    // sin refrescar. Payload interno: incluye el email del predicador.
    this.realtimeService.emitAIglesia(predicador.evento.iglesiaId, REALTIME_EVENTS.PREDICADOR_RESPONDIO, {
      eventoId: predicador.eventoId,
      predicadorId: predicador.id,
      nombre: predicador.nombre,
      email: predicador.email,
      estado: respuesta,
      respondidoAt,
    });

    // Página pública de estado de la convocatoria (link del correo). Sin email:
    // ahí lo ve cualquiera que tenga el link de ese evento.
    this.realtimeService.emitAConvocatoria(predicador.eventoId, REALTIME_EVENTS.PREDICADOR_RESPONDIO, {
      eventoId: predicador.eventoId,
      predicadorId: predicador.id,
      nombre: predicador.nombre,
      estado: respuesta,
      respondidoAt,
    });

    return this.getInvitacion(token);
  }
}
