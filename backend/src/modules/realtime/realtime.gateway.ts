import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { EstadoIglesia, Rol } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { ACCESS_TOKEN_COOKIE } from '../../common/constants/auth-cookies';
import { runWithTenantContext, updateTenantContext } from '../../common/context/tenant-context';
import { resolveCorsOrigins } from '../../common/utils/cors-origins.util';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseJwtVerifierService } from '../../supabase/supabase-jwt-verifier.service';
import { iglesiaRoom, SUPERADMIN_ROOM } from './realtime-rooms.util';
import { RealtimeService } from './realtime.service';

/**
 * Un único gateway (no uno por pantalla) para las 3 pantallas de la Fase 5 de
 * docs/supabase.md: dashboard del SuperAdmin, evento del Pastor y censo en
 * vivo. Decisión propia, distinta a lo que planteaba el doc original
 * (Supabase Realtime nativo vía postgres_changes): ese mecanismo transmite a
 * cualquier cliente con la anon key pública salvo que RLS esté activo
 * filtrando fila por fila, y RLS (Fase 8) todavía no existe. Este gateway en
 * cambio hace el scoping por tenant del mismo modo que cualquier query de
 * Prisma: el servidor decide a qué room se une cada socket, nunca el
 * cliente.
 *
 * Fase 7, corte final: el `access_token` en la cookie ahora lo emite Supabase
 * Auth (JWT ES256, verificable vía JWKS), no un JWT propio firmado con
 * JWT_ACCESS_SECRET — por eso este gateway verifica con
 * `SupabaseJwtVerifierService` (mismo servicio que usa `JwtAuthGuard` del
 * lado HTTP) y vuelve a consultar `rol`/`iglesiaId` frescos de la BD en vez
 * de confiar en los claims del token, igual criterio que `JwtAuthGuard`.
 */
@WebSocketGateway({
  cors: { origin: resolveCorsOrigins(), credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly supabaseJwtVerifier: SupabaseJwtVerifierService,
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtimeService.setServer(server);
  }

  /**
   * Autenticación y join a la room correspondiente, una sola vez al conectar
   * (acá no hay mensajes entrantes del cliente, solo eventos salientes del
   * servidor). Mismo criterio mínimo que JwtAuthGuard: usuario activo e
   * iglesia no suspendida. A diferencia del HTTP (que revalida esto en cada
   * request), un socket que sigue abierto no se corta a mitad de conexión si
   * el usuario se desactiva o la iglesia entra en mora después de conectar —
   * limitación aceptada, acotada por la vida del propio socket (el frontend
   * reconecta con cookie fresca en cada carga de página).
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error('Sin token');
      }

      const usuarioId = await this.supabaseJwtVerifier.verifyAndExtractUsuarioId(token);

      // Fase 8 de docs/supabase.md (RLS): este socket no pasa por TenantContextMiddleware
      // (eso es HTTP-only) — hay que abrir el contexto de tenant a mano acá, mismo patrón
      // bootstrap-por-id que usa JwtAuthGuard (ver tenant-context.ts).
      //
      // Dos queries, no una con `include: { iglesia }`: la policy RLS de `iglesias` exige
      // iglesiaId en el contexto, que recién se conoce DESPUÉS de leer `usuario` — pedirla
      // como include anidado en el mismo query corre bajo el contexto viejo (solo
      // usuarioId) y Postgres descarta la fila completa (no solo el join), no únicamente el
      // campo `iglesia`. Mismo bug que tenía JwtAuthGuard (ver esa entrada en FEATURES.md),
      // encontrado acá también corriendo el QA de la Fase 5 (Realtime) contra RLS real.
      const usuario = await runWithTenantContext({ usuarioId }, async () => {
        const fila = await this.prisma.usuario.findUnique({
          where: { id: usuarioId },
          select: { rol: true, iglesiaId: true, activo: true },
        });

        if (!fila) {
          return null;
        }

        updateTenantContext({ iglesiaId: fila.iglesiaId, rol: fila.rol });

        const iglesia = fila.iglesiaId
          ? await this.prisma.iglesia.findUnique({ where: { id: fila.iglesiaId }, select: { estado: true } })
          : null;

        return { ...fila, iglesia };
      });

      if (!usuario?.activo) {
        throw new Error('Usuario inactivo');
      }

      if (usuario.iglesia?.estado === EstadoIglesia.SUSPENDIDA) {
        throw new Error('Iglesia suspendida');
      }

      if (usuario.rol === Rol.SUPER_ADMIN) {
        await client.join(SUPERADMIN_ROOM);
      } else if (usuario.iglesiaId) {
        await client.join(iglesiaRoom(usuario.iglesiaId));
      } else {
        throw new Error('Usuario sin iglesiaId ni rol SUPER_ADMIN');
      }
    } catch (error) {
      this.logger.warn(`Conexión rechazada: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // Nada que limpiar acá: socket.io ya saca al cliente de sus rooms al desconectar.
  }

  /**
   * Mismo criterio que la extracción de cookie de JwtAuthGuard, pero sobre el
   * header crudo del handshake: cookie-parser solo engancha al servidor HTTP
   * de Express, no a la conexión de socket.io. `handshake.auth.token` queda
   * como alternativa para clientes que no puedan mandar la cookie httpOnly
   * cross-site (mismo espíritu que el fallback Bearer de JwtAuthGuard).
   */
  private extractToken(client: Socket): string | null {
    const fromAuth = client.handshake.auth?.token as string | undefined;
    if (fromAuth) {
      return fromAuth;
    }

    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) {
      return null;
    }

    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`));

    if (!match) {
      return null;
    }

    try {
      return decodeURIComponent(match.slice(ACCESS_TOKEN_COOKIE.length + 1));
    } catch {
      return null;
    }
  }
}
