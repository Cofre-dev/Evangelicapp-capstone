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
import { Rol } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateNotaDto } from './dto/create-nota.dto';
import { UpdateNotaDto } from './dto/update-nota.dto';
import { NotasService } from './notas.service';

/**
 * Notas y recordatorios: de uso exclusivo del MANAGER (no es un módulo delegable
 * vía AccesoModulo — decisión de producto explícita). Cualquier USUARIO solo ve/
 * completa sus propias tareas asignadas, sin necesitar un módulo otorgado.
 */
@Controller('notas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.MANAGER)
export class NotasController {
  constructor(private readonly notasService: NotasService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query('incluirArchivados') incluirArchivados?: string) {
    return this.notasService.findAll(this.requireIglesiaId(user), incluirArchivados === 'true');
  }

  @Get('mis-tareas')
  @Roles(Rol.MANAGER, Rol.USUARIO)
  findMisTareas(@CurrentUser() user: JwtPayload) {
    return this.notasService.findMisTareas(this.requireIglesiaId(user), user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateNotaDto) {
    return this.notasService.create(this.requireIglesiaId(user), user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateNotaDto) {
    return this.notasService.update(this.requireIglesiaId(user), id, dto);
  }

  @Patch(':id/marcar-hecha')
  @Roles(Rol.MANAGER, Rol.USUARIO)
  marcarHecha(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notasService.marcarHecha(this.requireIglesiaId(user), user.sub, id);
  }

  @Patch(':id/archivar')
  archivar(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notasService.archivar(this.requireIglesiaId(user), id);
  }

  @Patch(':id/desarchivar')
  desarchivar(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notasService.desarchivar(this.requireIglesiaId(user), id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    return this.notasService.remove(this.requireIglesiaId(user), id);
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
