import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/**
 * Fase 7 de docs/supabase.md, paso 3: capacidad de verificar un access token
 * EMITIDO POR SUPABASE AUTH (proyecto de prueba) — deliberadamente separado de
 * `JwtStrategy`, que sigue siendo la única fuente de verdad para sesiones
 * reales. Nada llama a este servicio todavía desde ningún guard/controller
 * conectado a una ruta real; solo lo usa `SupabaseJwtAuthGuard` (paso 4),
 * también inerte por ahora.
 *
 * Verificación vía JWKS (`jose`), no con un secreto compartido: el proyecto
 * de prueba usa signing keys asimétricas (ES256, confirmado contra
 * `/auth/v1/.well-known/jwks.json`) — es el método que la propia
 * documentación de Supabase recomienda para verificar sin depender de un
 * round-trip al Auth server en cada request (a diferencia del modelo legacy
 * de shared secret HS256, donde ellos mismos recomiendan NO verificar la
 * firma a mano).
 *
 * A propósito NO toca la base de datos: solo criptografía + extracción de
 * claims. Quien llama (`SupabaseJwtAuthGuard`) es el único responsable de
 * volver a consultar `Usuario` con el `usuarioId` verificado — así hay una
 * sola query por request en vez de dos, y la fila fresca de la BD (no el
 * claim del token, que puede quedar desactualizado) es siempre la fuente de
 * verdad para `rol`/`iglesiaId`/`activo`/etc.
 */
export interface SupabaseTokenClaims extends JWTPayload {
  app_metadata?: {
    usuarioId?: string;
    rol?: string;
    iglesiaId?: string | null;
  };
}

@Injectable()
export class SupabaseJwtVerifierService {
  private readonly logger = new Logger(SupabaseJwtVerifierService.name);
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null;
  private readonly issuer: string | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_AUTH_TEST_URL');

    if (!url) {
      this.jwks = null;
      this.issuer = null;
      return;
    }

    this.issuer = `${url}/auth/v1`;
    this.jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  }

  /** Verifica firma/expiración/issuer y devuelve los claims ya validados. No consulta la BD. */
  async verifyAccessToken(token: string): Promise<SupabaseTokenClaims> {
    if (!this.jwks || !this.issuer) {
      throw new UnauthorizedException('Verificación de Supabase Auth no configurada en este entorno');
    }

    try {
      const { payload } = await jwtVerify<SupabaseTokenClaims>(token, this.jwks, { issuer: this.issuer });
      return payload;
    } catch (error) {
      this.logger.debug(`Token de Supabase Auth rechazado: ${(error as Error).message}`);
      throw new UnauthorizedException('Token de Supabase Auth inválido o expirado');
    }
  }

  /** Conveniencia: verifica y devuelve directo el `usuarioId` embebido, o rechaza si falta. */
  async verifyAndExtractUsuarioId(token: string): Promise<string> {
    const claims = await this.verifyAccessToken(token);
    const usuarioId = claims.app_metadata?.usuarioId;
    if (!usuarioId) {
      throw new UnauthorizedException('Token de Supabase Auth sin usuarioId en app_metadata');
    }
    return usuarioId;
  }
}
