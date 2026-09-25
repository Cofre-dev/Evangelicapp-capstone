import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EstadoIglesia, Rol } from '@prisma/client';
import { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from '../constants/auth-cookies';
import { MUST_CHANGE_PASSWORD_ALLOWLIST } from '../constants/must-change-password-allowlist';
import { updateTenantContext } from '../context/tenant-context';
import { IglesiaSuspendidaException } from '../exceptions/iglesia-suspendida.exception';
import { calcularEstadoFacturacion } from '../utils/calcular-facturacion';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseJwtVerifierService } from '../../supabase/supabase-jwt-verifier.service';

/**
 * Guard por defecto para toda ruta autenticada. Fase 7 de docs/supabase.md,
 * corte final: valida el access token de Supabase Auth vía JWKS
 * (SupabaseJwtVerifierService) y revalida, en la misma query, las mismas 3
 * cosas que antes hacía JwtStrategy: `activo`, `iglesia.estado ===
 * SUSPENDIDA`, y el allowlist de `mustChangePassword`. Absorbe lo que antes
 * era el guard aparte `SupabaseJwtAuthGuard` (Fase 7, paso 4) — mantenerlos
 * como dos guards casi idénticos después del corte invitaba a que se
 * desincronizaran.
 *
 * Acepta el token desde la cookie httpOnly `access_token` (flujo real) o
 * desde el header Authorization: Bearer (compatibilidad, igual que antes).
 *
 * Limitación conocida, ya no aplica del todo: a diferencia del JwtStrategy
 * anterior, acá `modulos` SÍ se resuelve fresco en cada request (mismo query
 * que ya paga por `activo`/`iglesia`) — el caveat de "hasta 15 min de
 * desactualización" que existía antes solo sigue aplicando a `rol`/`iglesiaId`,
 * que vienen de la fila de Usuario recién leída, no del token.
 *
 * Fase 8 de docs/supabase.md (RLS): también es quien puebla el contexto de
 * tenant (ver tenant-context.ts) que usa `PrismaService` para que las
 * policies de Postgres sepan a qué iglesia scopear cada query del resto del
 * request.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly verifier: SupabaseJwtVerifierService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Falta el token de sesión');
    }

    const usuarioId = await this.verifier.verifyAndExtractUsuarioId(token);

    // Fase 8 de docs/supabase.md (RLS): hay que fijar el usuarioId en el contexto de
    // tenant ANTES de la query de abajo — la policy de `usuarios` permite auto-lectura
    // por `id` precisamente para resolver este huevo-y-gallina (todavía no sabemos
    // `iglesiaId`, que es justo lo que esta query va a decirnos).
    updateTenantContext({ usuarioId });

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        email: true,
        rol: true,
        iglesiaId: true,
        activo: true,
        mustChangePassword: true,
        iglesia: { select: { estado: true, proximaFacturacion: true } },
      },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Sesión inválida o usuario inactivo');
    }

    // A partir de acá el resto del request (este guard, el controller, los servicios que
    // llame) ya queda scoped a la iglesia real del usuario para efectos de RLS.
    updateTenantContext({ iglesiaId: usuario.iglesiaId, rol: usuario.rol });

    if (usuario.iglesia?.estado === EstadoIglesia.SUSPENDIDA) {
      const { diasEnMora } = calcularEstadoFacturacion(usuario.iglesia.proximaFacturacion);
      throw new IglesiaSuspendidaException(diasEnMora);
    }

    if (usuario.mustChangePassword && !MUST_CHANGE_PASSWORD_ALLOWLIST.has(request.path)) {
      throw new ForbiddenException('Debe cambiar su contraseña temporal antes de continuar');
    }

    // Query separada (no un include anidado en el findUnique de arriba): la policy RLS de
    // accesos_modulo exige iglesiaId en el contexto de tenant, que recién queda seteado en
    // la línea de arriba — si se pide como include del mismo query, corre bajo el contexto
    // viejo (solo usuarioId) y RLS lo filtra a 0 filas siempre, sin importar los accesos
    // reales del usuario. Encontrado corriendo el backend contra una base con RLS realmente
    // activa (app_runtime, no postgres) por primera vez — en producción quedaba enmascarado
    // porque DATABASE_URL todavía conecta como postgres (BYPASSRLS).
    const modulos =
      usuario.rol === Rol.USUARIO
        ? (
            await this.prisma.accesoModulo.findMany({
              where: { usuarioId: usuario.id },
              select: { modulo: true },
            })
          ).map((acceso) => acceso.modulo)
        : [];

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      iglesiaId: usuario.iglesiaId,
      modulos,
    };

    (request as Request & { user: JwtPayload }).user = payload;
    return true;
  }

  private extractToken(request: Request): string | null {
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const fromCookie = cookies?.[ACCESS_TOKEN_COOKIE];
    if (fromCookie) {
      return fromCookie;
    }

    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }

    return null;
  }
}
