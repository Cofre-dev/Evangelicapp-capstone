import { Controller, Get, UseGuards } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SuperAdminService } from './super-admin.service';

/** Única vista con visibilidad cruzada de tenants — por diseño, solo SUPER_ADMIN. */
@Controller('superadmin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.SUPER_ADMIN)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.superAdminService.getDashboard();
  }
}
