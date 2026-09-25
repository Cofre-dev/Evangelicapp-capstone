import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoConfirmacionAsistencia } from '@prisma/client';
import { runAsService } from '../../common/context/tenant-context';
import { buildGoogleCalendarLink } from '../../common/utils/google-calendar-link';
import { PrismaService } from '../../prisma/prisma.service';
import { REALTIME_EVENTS } from '../realtime/realtime-rooms.util';
import { RealtimeService } from '../realtime/realtime.service';

/**
 * Fase 8 de docs/supabase.md (RLS): toda la clase es la ruta pública por token (ver
 * AsistenciasController) — mismo criterio que PredicadoresService, cada método público
 * corre en `runAsService` (bypass explícito de tenant).
 */
@Injectable()
export class AsistenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /** Público: lo que ve el integrante al abrir el link del email. */
  async getInvitacion(token: string) {
    return runAsService(() => this.getInvitacionComoServicio(token));
  }

  private async getInvitacionComoServicio(token: string) {
    const asistencia = await this.prisma.asistenciaEvento.findUnique({
      where: { tokenConfirmacion: token },
      include: {
        evento: {
          select: {
            titulo: true,
            descripcion: true,
            fechaInicio: true,
            fechaFin: true,
            ubicacion: true,
            iglesia: { select: { nombre: true, logoUrl: true } },
          },
        },
        integrante: { select: { nombreCompleto: true, email: true } },
      },
    });

    if (!asistencia) {
      throw new NotFoundException('Invitación no encontrada');
    }

    return this.buildRespuesta(asistencia);
  }

  async responder(token: string, respuesta: 'CONFIRMADO' | 'RECHAZADO') {
    return runAsService(() => this.responderComoServicio(token, respuesta));
  }

  private async responderComoServicio(token: string, respuesta: 'CONFIRMADO' | 'RECHAZADO') {
    const asistencia = await this.prisma.asistenciaEvento.findUnique({
      where: { tokenConfirmacion: token },
      include: {
        evento: { select: { id: true, iglesiaId: true } },
        integrante: { select: { id: true, nombreCompleto: true } },
      },
    });

    if (!asistencia) {
      throw new NotFoundException('Invitación no encontrada');
    }

    // El link es de un solo uso: sin esto, cualquiera con el link podría alternar
    // CONFIRMADO/RECHAZADO indefinidamente después de la primera respuesta.
    if (asistencia.estado !== EstadoConfirmacionAsistencia.PENDIENTE) {
      throw new BadRequestException('Esta invitación ya fue respondida');
    }

    const respondidoAt = new Date();
    await this.prisma.asistenciaEvento.update({
      where: { tokenConfirmacion: token },
      data: { estado: respuesta, respondidoAt },
    });

    // La pantalla de asistencias del evento (equipo de la iglesia) se entera en vivo
    // de cada RSVP, sin refrescar — mismo patrón que predicador:respondio.
    const payload = {
      eventoId: asistencia.evento.id,
      integranteId: asistencia.integrante.id,
      nombreCompleto: asistencia.integrante.nombreCompleto,
      estado: respuesta,
      respondidoAt,
    };
    this.realtimeService.emitAIglesia(
      asistencia.evento.iglesiaId,
      REALTIME_EVENTS.ASISTENCIA_RESPONDIDA,
      payload,
    );
    // Y a la página pública de estado de la convocatoria (link del correo). El
    // payload ya no trae email, así que sirve igual para ambos canales.
    this.realtimeService.emitAConvocatoria(
      asistencia.evento.id,
      REALTIME_EVENTS.ASISTENCIA_RESPONDIDA,
      payload,
    );

    return this.getInvitacion(token);
  }

  private buildRespuesta(asistencia: {
    estado: EstadoConfirmacionAsistencia;
    respondidoAt: Date | null;
    integrante: { nombreCompleto: string; email: string };
    evento: {
      titulo: string;
      descripcion: string | null;
      fechaInicio: Date;
      fechaFin: Date;
      ubicacion: string | null;
      iglesia: { nombre: string; logoUrl: string | null };
    };
  }) {
    return {
      nombre: asistencia.integrante.nombreCompleto,
      email: asistencia.integrante.email,
      estado: asistencia.estado,
      respondidoAt: asistencia.respondidoAt,
      evento: {
        titulo: asistencia.evento.titulo,
        descripcion: asistencia.evento.descripcion,
        fechaInicio: asistencia.evento.fechaInicio,
        fechaFin: asistencia.evento.fechaFin,
        ubicacion: asistencia.evento.ubicacion,
      },
      iglesia: asistencia.evento.iglesia,
      // Ya armado acá para que el frontend solo tenga que renderizar el botón
      // "Agregar a Google Calendar" apenas la persona entra a la página.
      googleCalendarLink: buildGoogleCalendarLink({
        titulo: asistencia.evento.titulo,
        fechaInicio: asistencia.evento.fechaInicio,
        fechaFin: asistencia.evento.fechaFin,
        descripcion: asistencia.evento.descripcion,
        ubicacion: asistencia.evento.ubicacion,
      }),
    };
  }
}
