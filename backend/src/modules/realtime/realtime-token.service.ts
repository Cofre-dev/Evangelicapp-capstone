import { ForbiddenException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Rol } from '@prisma/client';
import { SignJWT } from 'jose';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { convocatoriaTopic, SUPERADMIN_TOPIC, tenantTopic } from './realtime-rooms.util';

export interface RealtimeTokenResponse {
  /** JWT HS256 de vida corta, para `supabase.realtime.setAuth(token)` en el frontend. */
  token: string;
  /** Único topic (canal privado) que el frontend debe abrir con este token. */
  topic: string;
  /** Segundos de validez — el frontend re-pide un token nuevo antes de que expire. */
  expiresInSeconds: number;
}

const DEFAULT_TTL_SECONDS = 1800;

/**
 * Emite tokens de corta duración para que el navegador pueda autenticar su
 * conexión de WebSocket a Supabase Realtime (ver docs/realtime-migration.md).
 *
 * Por qué el backend firma este token y no se reusa el `access_token` de la
 * sesión:
 *  1. El `access_token` lo emite un proyecto de Supabase distinto
 *     (`Backend-auth-test`) al que corre Realtime/DB (`Backend`) — un JWT del
 *     proyecto A no lo acepta Realtime del proyecto B.
 *  2. El `access_token` vive en una cookie `httpOnly`: el JS del frontend no lo
 *     puede leer para pasárselo a `supabase-js`.
 *
 * Este token se firma con el JWT secret del proyecto `Backend` (HS256), lleva
 * `role: authenticated` + los claims `iglesia_id` / `is_superadmin` que la
 * policy RLS de `realtime.messages` usa para decidir a qué topic puede
 * suscribirse el cliente. TTL corto (30 min por defecto) porque, a diferencia
 * de la cookie de sesión, este sí queda en memoria del JS (expuesto a un XSS).
 * Mitigación: no sirve para leer datos de negocio por PostgREST (esas policies
 * van por `current_setting('app.*')`, que PostgREST nunca setea) ni para emitir
 * (no hay policy de INSERT para `authenticated`).
 */
@Injectable()
export class RealtimeTokenService {
  private readonly logger = new Logger(RealtimeTokenService.name);
  private readonly secret: Uint8Array | null;
  private readonly ttlSeconds: number;

  constructor(config: ConfigService) {
    // Legacy JWT secret (simétrico, HS256) del proyecto `Backend` — Dashboard >
    // Project Settings > API > JWT Settings.
    const raw = config.get<string>('SUPABASE_JWT_ACCESS_SECRET');
    this.secret = raw ? new TextEncoder().encode(raw) : null;

    const ttl = Number(config.get<string>('REALTIME_TOKEN_TTL_SECONDS'));
    this.ttlSeconds = Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : DEFAULT_TTL_SECONDS;

    if (!this.secret) {
      this.logger.warn(
        'SUPABASE_JWT_ACCESS_SECRET sin configurar — GET /realtime/token responde 503 (el frontend cae a socket.io mientras dure el parallel-run).',
      );
    }
  }

  get configured(): boolean {
    return this.secret !== null;
  }

  async mint(user: JwtPayload): Promise<RealtimeTokenResponse> {
    if (!this.secret) {
      throw new ServiceUnavailableException('Realtime no está configurado en este entorno');
    }

    const isSuperAdmin = user.rol === Rol.SUPER_ADMIN;

    if (!isSuperAdmin && !user.iglesiaId) {
      // No debería pasar (solo SUPER_ADMIN tiene iglesiaId null), pero sin topic
      // no hay nada a lo que suscribirse.
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }

    const topic = isSuperAdmin ? SUPERADMIN_TOPIC : tenantTopic(user.iglesiaId as string);

    const token = await new SignJWT({
      role: 'authenticated',
      iglesia_id: user.iglesiaId,
      is_superadmin: isSuperAdmin,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.sub)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.secret);

    return { token, topic, expiresInSeconds: this.ttlSeconds };
  }

  /**
   * Token para la página PÚBLICA de estado de la convocatoria de un evento (se
   * llega desde el link del correo, sin cuenta). El claim `evento_id` es lo que
   * la policy RLS de `realtime.messages` usa para dejar suscribirse solo al topic
   * `convocatoria:<eventoId>`. El llamador (`ConvocatoriaService`) ya resolvió el
   * `eventoId` a partir del token de asistencia/predicador del destinatario.
   */
  async mintForConvocatoria(eventoId: string): Promise<RealtimeTokenResponse> {
    if (!this.secret) {
      throw new ServiceUnavailableException('Realtime no está configurado en este entorno');
    }

    const token = await new SignJWT({ role: 'authenticated', evento_id: eventoId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(`convocatoria:${eventoId}`)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.secret);

    return { token, topic: convocatoriaTopic(eventoId), expiresInSeconds: this.ttlSeconds };
  }
}
