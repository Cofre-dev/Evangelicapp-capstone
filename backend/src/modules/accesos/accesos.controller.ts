import { Body, Controller, ForbiddenException, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AccesosService } from './accesos.service';
import { ReemplazarAccesosDto } from './dto/reemplazar-accesos.dto';

/** El MANAGER otorga/revoca acceso a módulos para su equipo (rol USUARIO). */
@Controller('accesos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.MANAGER)
export class AccesosController {
  constructor(private readonly accesosService: AccesosService) {}

  @Get('catalogo')
  catalogo() {
    return this.accesosService.catalogo();
  }

  @Get('usuarios')
  findUsuarios(@CurrentUser() user: JwtPayload) {
    return this.accesosService.findUsuariosConAccesos(this.requireIglesiaId(user));
  }

  @Put('usuarios/:usuarioId')
  reemplazar(
    @CurrentUser() user: JwtPayload,
    @Param('usuarioId') usuarioId: string,
    @Body() dto: ReemplazarAccesosDto,
  ) {
    return this.accesosService.reemplazarAccesos(
      this.requireIglesiaId(user),
      usuarioId,
      dto.modulos,
      user.sub,
    );
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
