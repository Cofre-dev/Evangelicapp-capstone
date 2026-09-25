import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

/** Gestión del equipo (rol USUARIO) de la propia iglesia. Solo MANAGER. */
@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.MANAGER)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.usuariosService.findAllForIglesia(this.requireIglesiaId(user));
  }

  /** Directorio tipo tarjeta de presentación (foto + cargo), visible para todo el equipo. */
  @Get('equipo')
  @Roles(Rol.MANAGER, Rol.USUARIO)
  findDirectorio(@CurrentUser() user: JwtPayload) {
    return this.usuariosService.findDirectorio(this.requireIglesiaId(user));
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(this.requireIglesiaId(user), dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateUsuarioDto) {
    return this.usuariosService.update(this.requireIglesiaId(user), id, dto);
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
