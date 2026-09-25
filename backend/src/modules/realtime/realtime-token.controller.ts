import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { RealtimeTokenService } from './realtime-token.service';

/**
 * `GET /realtime/token` — el frontend lo llama al montar una pantalla en vivo y
 * cada vez que el token anterior está por expirar, para autenticar su conexión
 * de WebSocket a Supabase Realtime (ver docs/realtime-migration.md y prompt.md).
 *
 * Sin `RolesGuard`: cualquier sesión válida puede pedir un token. El propio
 * `JwtAuthGuard` ya revalida `activo` / `iglesia.estado` / `mustChangePassword`
 * en cada llamada — una iglesia suspendida no consigue token nuevo (el que ya
 * tenga expira solo en ≤30 min). El topic lo decide `RealtimeTokenService` a
 * partir del rol/iglesiaId del JWT, nunca de un parámetro del request.
 */
@Controller('realtime')
@UseGuards(JwtAuthGuard)
export class RealtimeTokenController {
  constructor(private readonly tokenService: RealtimeTokenService) {}

  @Get('token')
  @Throttle({ default: { limit: 30, ttl: minutes(1) } })
  getToken(@CurrentUser() user: JwtPayload) {
    return this.tokenService.mint(user);
  }
}
