import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { RealtimeBroadcastService } from './realtime-broadcast.service';
import {
  convocatoriaTopic,
  iglesiaRoom,
  SUPERADMIN_ROOM,
  SUPERADMIN_TOPIC,
  tenantTopic,
} from './realtime-rooms.util';

/**
 * Fachada única que usan las services de negocio (IglesiasService,
 * PredicadoresService, IntegrantesService) para emitir eventos en vivo sin
 * conocer ningún transporte.
 *
 * Migración a Supabase Realtime (ver docs/realtime-migration.md): durante el
 * parallel-run cada evento sale por LOS DOS transportes a la vez —
 *   - socket.io (RealtimeGateway) → rooms `superadmin` / `iglesia:{id}`  (legacy)
 *   - Supabase Broadcast (REST)   → topics `superadmin` / `tenant:{id}`
 * Cuando el frontend haya migrado los 4 consumidores y se verifique en staging,
 * se remueve la mitad de socket.io (gateway + deps) y esta clase se queda solo
 * con `broadcast`.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server?: Server;

  constructor(private readonly broadcast: RealtimeBroadcastService) {}

  setServer(server: Server): void {
    this.server = server;
  }

  emitAIglesia(iglesiaId: string, evento: string, payload: unknown): void {
    this.emitSocketIo(iglesiaRoom(iglesiaId), evento, payload);
    void this.broadcast.publish(tenantTopic(iglesiaId), evento, payload);
  }

  emitASuperAdmin(evento: string, payload: unknown): void {
    this.emitSocketIo(SUPERADMIN_ROOM, evento, payload);
    void this.broadcast.publish(SUPERADMIN_TOPIC, evento, payload);
  }

  /**
   * Estado en vivo de la convocatoria de un evento (predicadores + integrantes),
   * para la página pública a la que se llega desde el link del correo. Solo
   * Supabase Broadcast: ese canal lo abre gente sin sesión, socket.io no aplica.
   */
  emitAConvocatoria(eventoId: string, evento: string, payload: unknown): void {
    void this.broadcast.publish(convocatoriaTopic(eventoId), evento, payload);
  }

  private emitSocketIo(room: string, evento: string, payload: unknown): void {
    if (!this.server) {
      this.logger.warn(`Emit "${evento}" por socket.io ignorado: el gateway todavía no inicializa`);
      return;
    }
    this.server.to(room).emit(evento, payload);
  }
}
