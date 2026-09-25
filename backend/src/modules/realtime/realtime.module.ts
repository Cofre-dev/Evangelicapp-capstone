import { Module } from '@nestjs/common';
import { RealtimeBroadcastService } from './realtime-broadcast.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { RealtimeTokenController } from './realtime-token.controller';
import { RealtimeTokenService } from './realtime-token.service';

/**
 * Parallel-run de la migración a Supabase Realtime (ver docs/realtime-migration.md):
 *  - `RealtimeGateway` (socket.io) sigue vivo hasta que el frontend migre.
 *  - `RealtimeBroadcastService` publica los mismos eventos por Supabase Broadcast.
 *  - `RealtimeTokenController` emite los tokens de corta duración que el frontend
 *    necesita para autenticar su WebSocket contra Supabase.
 */
@Module({
  controllers: [RealtimeTokenController],
  providers: [RealtimeGateway, RealtimeService, RealtimeBroadcastService, RealtimeTokenService],
  exports: [RealtimeService, RealtimeTokenService],
})
export class RealtimeModule {}
