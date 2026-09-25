import { Injectable, NotFoundException } from '@nestjs/common';
import { runAsService } from '../../common/context/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeTokenResponse, RealtimeTokenService } from '../realtime/realtime-token.service';

/**
 * Página PÚBLICA de "estado de la convocatoria" de un evento: a quién se invitó
 * a predicar y a la congregación, y quién confirmó / rechazó / sigue sin
 * responder. Se llega desde el botón del correo de invitación (predicador o
 * integrante) — sin cuenta.
 *
 * Autenticación: el `token` de la URL es el `tokenConfirmacion` del propio
 * destinatario (asistencia O predicador). No lo consume — solo lo usa para
 * resolver a qué evento pertenece. Fase 8 de docs/supabase.md: todo corre en
 * `runAsService` (bypass explícito de tenant), igual que el resto de rutas
 * públicas por token.
 *
 * NO expone emails: en esta página los ve cualquiera que tenga un link de ese
 * evento (toda la congregación + los predicadores invitados).
 */
@Injectable()
export class ConvocatoriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeTokenService: RealtimeTokenService,
  ) {}

  async getEstado(token: string) {
    return runAsService(async () => {
      const eventoId = await this.resolverEventoId(token);

      const [evento, predicadores, asistencias] = await Promise.all([
        this.prisma.evento.findUnique({
          where: { id: eventoId },
          select: {
            titulo: true,
            descripcion: true,
            fechaInicio: true,
            fechaFin: true,
            ubicacion: true,
            iglesia: { select: { nombre: true, logoUrl: true } },
          },
        }),
        this.prisma.predicador.findMany({
          where: { eventoId },
          orderBy: { createdAt: 'asc' },
          select: { id: true, nombre: true, estado: true, respondidoAt: true },
        }),
        this.prisma.asistenciaEvento.findMany({
          where: { eventoId },
          orderBy: { integrante: { nombreCompleto: 'asc' } },
          select: {
            integranteId: true,
            estado: true,
            respondidoAt: true,
            integrante: { select: { nombreCompleto: true } },
          },
        }),
      ]);

      if (!evento) {
        throw new NotFoundException('Enlace no válido');
      }

      return {
        evento: {
          titulo: evento.titulo,
          descripcion: evento.descripcion,
          fechaInicio: evento.fechaInicio,
          fechaFin: evento.fechaFin,
          ubicacion: evento.ubicacion,
          iglesia: evento.iglesia,
        },
        predicadores: predicadores.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          estado: p.estado,
          respondidoAt: p.respondidoAt,
        })),
        asistencias: asistencias.map((a) => ({
          integranteId: a.integranteId,
          nombreCompleto: a.integrante.nombreCompleto,
          estado: a.estado,
          respondidoAt: a.respondidoAt,
        })),
      };
    });
  }

  /** Token de Realtime (vida corta) para que la página se actualice en vivo. */
  async getRealtimeToken(token: string): Promise<RealtimeTokenResponse> {
    return runAsService(async () => {
      const eventoId = await this.resolverEventoId(token);
      return this.realtimeTokenService.mintForConvocatoria(eventoId);
    });
  }

  private async resolverEventoId(token: string): Promise<string> {
    const asistencia = await this.prisma.asistenciaEvento.findUnique({
      where: { tokenConfirmacion: token },
      select: { eventoId: true },
    });
    if (asistencia) {
      return asistencia.eventoId;
    }

    const predicador = await this.prisma.predicador.findUnique({
      where: { tokenConfirmacion: token },
      select: { eventoId: true },
    });
    if (predicador) {
      return predicador.eventoId;
    }

    throw new NotFoundException('Enlace no válido');
  }
}
