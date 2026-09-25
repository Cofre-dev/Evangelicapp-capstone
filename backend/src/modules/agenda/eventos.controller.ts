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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModuloAccessGuard } from '../../common/guards/modulo-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';
import { EventosService } from './eventos.service';

/** Agenda compartida del equipo de la iglesia (manager y usuarios con el módulo Agenda). */
@Controller('agenda/eventos')
@UseGuards(JwtAuthGuard, RolesGuard, ModuloAccessGuard)
@Roles(Rol.MANAGER, Rol.USUARIO)
@Modulo(ModuloSistema.AGENDA)
export class EventosController {
  constructor(private readonly eventosService: EventosService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.eventosService.findAll(
      this.requireIglesiaId(user),
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.eventosService.findOne(this.requireIglesiaId(user), id);
  }

  /** Quién de los Integrantes convocados confirmó, rechazó o sigue sin responder. */
  @Get(':id/asistencias')
  findAsistencias(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.eventosService.findAsistencias(this.requireIglesiaId(user), id);
  }

  /** Estado completo de la convocatoria: predicadores invitados + integrantes convocados. */
  @Get(':id/convocatoria')
  findConvocatoria(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.eventosService.findConvocatoria(this.requireIglesiaId(user), id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEventoDto) {
    return this.eventosService.create(this.requireIglesiaId(user), user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateEventoDto) {
    return this.eventosService.update(this.requireIglesiaId(user), id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    return this.eventosService.remove(this.requireIglesiaId(user), id);
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
