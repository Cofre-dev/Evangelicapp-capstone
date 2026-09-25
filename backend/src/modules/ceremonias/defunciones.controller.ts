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
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ModuloSistema, Rol } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Modulo } from '../../common/decorators/modulo.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ConfirmPasswordDto } from '../../common/dto/confirm-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModuloAccessGuard } from '../../common/guards/modulo-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { DefuncionesService } from './defunciones.service';
import { CreateDefuncionDto } from './dto/create-defuncion.dto';
import { UpdateDefuncionDto } from './dto/update-defuncion.dto';

@Controller('ceremonias/defunciones')
@UseGuards(JwtAuthGuard, RolesGuard, ModuloAccessGuard)
@Roles(Rol.MANAGER, Rol.USUARIO)
@Modulo(ModuloSistema.CEREMONIAS)
export class DefuncionesController {
  constructor(private readonly defuncionesService: DefuncionesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.defuncionesService.findAll(
      this.requireIglesiaId(user),
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.defuncionesService.findOne(this.requireIglesiaId(user), id);
  }

  @Get(':id/certificado')
  async certificado(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, folio } = await this.defuncionesService.generarCertificado(
      this.requireIglesiaId(user),
      id,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificado_defuncion_${folio}.pdf"`,
    });

    return new StreamableFile(buffer);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDefuncionDto) {
    return this.defuncionesService.create(this.requireIglesiaId(user), user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateDefuncionDto) {
    return this.defuncionesService.update(this.requireIglesiaId(user), id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ConfirmPasswordDto,
  ): Promise<void> {
    return this.defuncionesService.remove(this.requireIglesiaId(user), id, user.sub, dto);
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
