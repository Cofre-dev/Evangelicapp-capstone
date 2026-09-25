import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ModuloSistema, Rol, TipoMovimiento } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Modulo } from '../../common/decorators/modulo.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModuloAccessGuard } from '../../common/guards/modulo-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';

@Controller('finanzas/categorias')
@UseGuards(JwtAuthGuard, RolesGuard, ModuloAccessGuard)
@Roles(Rol.MANAGER, Rol.USUARIO)
@Modulo(ModuloSistema.FINANZAS)
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('tipo') tipo?: TipoMovimiento,
    @Query('departamentoId') departamentoId?: string,
    @Query('general') general?: string,
  ) {
    return this.categoriasService.findAll(
      this.requireIglesiaId(user),
      tipo,
      departamentoId,
      general === 'true',
    );
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCategoriaDto) {
    return this.categoriasService.create(this.requireIglesiaId(user), dto);
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
