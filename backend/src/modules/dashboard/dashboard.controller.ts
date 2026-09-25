import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { DashboardService } from './dashboard.service';

/**
 * Landing con KPIs de la propia iglesia para MANAGER/USUARIO. Deliberadamente sin
 * SUPER_ADMIN (tiene su propio landing en GET /superadmin/dashboard, con
 * visibilidad cross-tenant).
 *
 * No vive en `mi-iglesia` porque ese módulo es exclusivo de MANAGER — USUARIO también
 * necesita este landing, acotado a los módulos que tenga otorgados (ver DashboardService).
 */
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.MANAGER, Rol.USUARIO)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(@CurrentUser() user: JwtPayload) {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return this.dashboardService.getDashboard(user.iglesiaId, user.sub, user.rol, user.modulos);
  }
}
