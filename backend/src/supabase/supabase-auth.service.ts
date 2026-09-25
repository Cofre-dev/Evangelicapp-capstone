import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Rol } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sesión real emitida por GoTrue (Supabase Auth) — `accessToken` es un JWT
 * verificable vía JWKS (ver SupabaseJwtVerifierService), `refreshToken` es un
 * string opaco (no un JWT, a diferencia del access token), propio de GoTrue.
 */
export interface SupabaseSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  supabaseUserId: string;
}

interface GoTrueTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string };
}

/**
 * Fase 7 de docs/supabase.md, corte final: `auth.users` de un proyecto de
 * Supabase separado, dedicado solo a probar Auth (`Backend-auth-test`), NUNCA
 * el proyecto real que ya usa SupabaseStorageService para Storage. Desde este
 * corte, `signInWithPassword`/`refreshSession` SÍ son la fuente real de
 * autenticación (ver AuthService) — ya no es solo un espejo de acompañamiento.
 *
 * Deliberadamente tolerante a no estar configurado: `SUPABASE_AUTH_TEST_URL`/
 * `SUPABASE_AUTH_TEST_SERVICE_ROLE_KEY`/`SUPABASE_AUTH_TEST_ANON_KEY` son
 * opcionales (a diferencia de SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY de
 * Storage, que sí son obligatorios) — sin ellas, cualquier método que
 * dependa de la API REST de GoTrue lanza un error claro en vez de crashear
 * el arranque del backend, para que el resto del equipo pueda seguir
 * corriendo el server local sin una cuenta de prueba de Supabase Auth.
 */
@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);
  private readonly client: SupabaseClient | null;
  private readonly url: string | null;
  private readonly anonKey: string | null;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.url = config.get<string>('SUPABASE_AUTH_TEST_URL') ?? null;
    this.anonKey = config.get<string>('SUPABASE_AUTH_TEST_ANON_KEY') ?? null;
    const serviceRoleKey = config.get<string>('SUPABASE_AUTH_TEST_SERVICE_ROLE_KEY');

    this.client =
      this.url && serviceRoleKey
        ? createClient(this.url, serviceRoleKey, { auth: { persistSession: false } })
        : null;

    if (!this.client) {
      this.logger.warn(
        'SUPABASE_AUTH_TEST_URL/SUPABASE_AUTH_TEST_SERVICE_ROLE_KEY no configuradas — mirrorUsuario/syncPassword/signOut quedan desactivados.',
      );
    }
    if (!this.url || !this.anonKey) {
      this.logger.warn(
        'SUPABASE_AUTH_TEST_URL/SUPABASE_AUTH_TEST_ANON_KEY no configuradas — signInWithPassword/refreshSession no van a funcionar (login real bloqueado en este entorno).',
      );
    }
  }

  /**
   * Autenticación real contra GoTrue (`grant_type=password`). Devuelve `null`
   * en credenciales inválidas (GoTrue responde 400) — se distingue así de un
   * error real de configuración/red, que sí se lanza, para que
   * AuthService#validateUser pueda loguear claro cuál de los dos pasó en vez
   * de tratar ambos casos igual como "contraseña incorrecta".
   */
  async signInWithPassword(email: string, password: string): Promise<SupabaseSession | null> {
    if (!this.url || !this.anonKey) {
      throw new Error('Supabase Auth no está configurado en este entorno (falta URL o anon key)');
    }

    const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: this.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (response.status === 400 || response.status === 401) {
      return null;
    }

    if (!response.ok) {
      const detalle = await response.text();
      throw new Error(`Supabase Auth (signInWithPassword) respondió ${response.status}: ${detalle}`);
    }

    return this.parseTokenResponse((await response.json()) as GoTrueTokenResponse);
  }

  /**
   * Rota el refresh token (`grant_type=refresh_token`) — GoTrue maneja acá su
   * propia detección de reuso/expiración; a diferencia del password grant,
   * cualquier rechazo se trata como sesión inválida, así que siempre lanza en
   * vez de devolver null (no hay un "reintento con fallback" posible para un
   * refresh token, a diferencia de una contraseña).
   */
  async refreshSession(refreshToken: string): Promise<SupabaseSession> {
    if (!this.url || !this.anonKey) {
      throw new Error('Supabase Auth no está configurado en este entorno (falta URL o anon key)');
    }

    const response = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: this.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      const detalle = await response.text();
      throw new Error(`Supabase Auth (refreshSession) respondió ${response.status}: ${detalle}`);
    }

    return this.parseTokenResponse((await response.json()) as GoTrueTokenResponse);
  }

  /**
   * Best-effort y no bloqueante: se llama sin `await` desde
   * AuthService#validateUser, justo después de validar la contraseña (es el
   * único momento en que el backend tiene el password en texto plano — nunca
   * se persiste, solo viaja a la API de admin de Supabase Auth por HTTPS para
   * crear el usuario espejo). Si esto falla, el login real NO se ve afectado
   * en absoluto: solo se reintenta en el próximo login mientras
   * `supabaseUserId` siga null.
   */
  async mirrorUsuario(
    usuario: { id: string; email: string; rol: Rol; iglesiaId: string | null; supabaseUserId: string | null },
    password: string,
  ): Promise<void> {
    if (!this.client || usuario.supabaseUserId) {
      return;
    }

    const { data, error } = await this.client.auth.admin.createUser({
      email: usuario.email,
      password,
      email_confirm: true,
      app_metadata: { usuarioId: usuario.id, rol: usuario.rol, iglesiaId: usuario.iglesiaId },
    });

    if (error || !data.user) {
      throw new Error(error?.message ?? 'Supabase Auth no devolvió un usuario creado');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { supabaseUserId: data.user.id },
    });
  }

  /**
   * Corrige un espejo cuya contraseña quedó desincronizada (ej. el usuario
   * cambió su contraseña local después de haber sido espejado — ver
   * AuthService#validateUser, ruta de fallback). Usa la misma API de admin
   * que `mirrorUsuario`, con `service_role`.
   */
  async syncPassword(supabaseUserId: string, password: string): Promise<void> {
    if (!this.client) {
      return;
    }

    const { error } = await this.client.auth.admin.updateUserById(supabaseUserId, { password });
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Repunta el `app_metadata` de una cuenta de Supabase Auth YA EXISTENTE (encontrada
   * por email al hacer signInWithPassword) hacia esta fila real de `Usuario`. Necesario
   * porque el proyecto de prueba de Supabase Auth (`Backend-auth-test`) se comparte entre
   * distintos backings de Postgres (local, Supabase) — un mismo email+contraseña puede
   * resolver a una cuenta cuyo `app_metadata.usuarioId` quedó de un contexto anterior
   * (ej. una fila que solo existía en el Postgres local). Sin esto, `JwtAuthGuard`
   * recibiría un `usuarioId` que no existe (o pertenece a otra fila) en la base actual,
   * y el login fallaría en la siguiente request pese a que `/auth/login` devolvió 200.
   */
  async relinkUsuario(
    supabaseUserId: string,
    usuario: { id: string; rol: Rol; iglesiaId: string | null },
  ): Promise<void> {
    if (!this.client) {
      return;
    }

    const { error } = await this.client.auth.admin.updateUserById(supabaseUserId, {
      app_metadata: { usuarioId: usuario.id, rol: usuario.rol, iglesiaId: usuario.iglesiaId },
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Cierra la sesión del lado de Supabase (logout real, no solo limpiar
   * cookies locales) o revoca todas las sesiones de una cuenta tras un cambio
   * de contraseña — mismo efecto que antes tenía revocar todos los
   * RefreshToken locales. `accessToken` es el access token vigente de quien
   * pide la acción (GoTrue identifica la sesión/usuario a partir de ese JWT,
   * no de un id suelto). Best-effort a propósito: un logout o un cambio de
   * contraseña no debe fallar con 500 porque Supabase tuvo un hipo — el peor
   * caso es que la sesión vieja siga viva del lado de Supabase hasta que
   * expire sola (JWT_ACCESS_EXPIRATION, 15m).
   */
  async signOut(accessToken: string, scope: 'global' | 'local' | 'others' = 'global'): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const { error } = await this.client.auth.admin.signOut(accessToken, scope);
      if (error) {
        this.logger.warn(`No se pudo cerrar la sesión en Supabase Auth: ${error.message}`);
      }
    } catch (error) {
      this.logger.warn(`No se pudo cerrar la sesión en Supabase Auth: ${(error as Error).message}`);
    }
  }

  private parseTokenResponse(json: GoTrueTokenResponse): SupabaseSession {
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in,
      supabaseUserId: json.user.id,
    };
  }
}
