import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ModuloSistema, Rol } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Modulo } from '../../common/decorators/modulo.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ConfirmPasswordDto } from '../../common/dto/confirm-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModuloAccessGuard } from '../../common/guards/modulo-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { DepartamentosService } from './departamentos.service';
import { CreateDepartamentoDto } from './dto/create-departamento.dto';
import { UpdateDepartamentoDto } from './dto/update-departamento.dto';

@Controller('finanzas/departamentos')
@UseGuards(JwtAuthGuard, RolesGuard, ModuloAccessGuard)
@Roles(Rol.MANAGER, Rol.USUARIO)
@Modulo(ModuloSistema.FINANZAS)
export class DepartamentosController {
  constructor(private readonly departamentosService: DepartamentosService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query('incluirInactivos') incluirInactivos?: string) {
    return this.departamentosService.findAll(this.requireIglesiaId(user), incluirInactivos === 'true');
  }

  /**
   * Solo MANAGER: los departamentos son estructura organizacional, no un movimiento
   * operativo del día a día. Sin @Modulo a propósito — exclusivo del manager aunque
   * el usuario tenga el módulo Finanzas otorgado (sin cambio de comportamiento).
   */
  @Post()
  @Roles(Rol.MANAGER)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDepartamentoDto) {
    return this.departamentosService.create(this.requireIglesiaId(user), user.sub, dto);
  }

  @Patch(':id')
  @Roles(Rol.MANAGER)
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateDepartamentoDto) {
    return this.departamentosService.update(this.requireIglesiaId(user), id, dto);
  }

  @Delete(':id')
  @Roles(Rol.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ConfirmPasswordDto,
  ): Promise<void> {
    return this.departamentosService.remove(this.requireIglesiaId(user), id, user.sub, dto);
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
