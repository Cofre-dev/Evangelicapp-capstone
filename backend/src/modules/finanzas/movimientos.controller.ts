import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ModuloSistema, Rol, TipoMovimiento } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Modulo } from '../../common/decorators/modulo.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ConfirmPasswordDto } from '../../common/dto/confirm-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModuloAccessGuard } from '../../common/guards/modulo-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { FinanzasImportService } from './finanzas-import.service';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { ImportarMovimientosDto } from './dto/importar-movimientos.dto';
import { PlantillaMovimientosDto } from './dto/plantilla-movimientos.dto';
import { UpdateMovimientoDto } from './dto/update-movimiento.dto';
import { importMovimientosMulterOptions } from './import-movimientos-upload.config';
import { MovimientosService } from './movimientos.service';

@Controller('finanzas/movimientos')
@UseGuards(JwtAuthGuard, RolesGuard, ModuloAccessGuard)
@Roles(Rol.MANAGER, Rol.USUARIO)
@Modulo(ModuloSistema.FINANZAS)
export class MovimientosController {
  constructor(
    private readonly movimientosService: MovimientosService,
    private readonly finanzasImportService: FinanzasImportService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tipo') tipo?: TipoMovimiento,
    @Query('departamentoId') departamentoId?: string,
    @Query('general') general?: string,
  ) {
    return this.movimientosService.findAll(
      this.requireIglesiaId(user),
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      tipo,
      departamentoId,
      general === 'true',
    );
  }

  @Get('dashboard')
  dashboard(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('departamentoId') departamentoId?: string,
    @Query('general') general?: string,
  ) {
    return this.movimientosService.dashboard(
      this.requireIglesiaId(user),
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      departamentoId,
      general === 'true',
    );
  }

  @Get('logs')
  logs(
    @CurrentUser() user: JwtPayload,
    @Query('departamentoId') departamentoId?: string,
    @Query('general') general?: string,
  ) {
    return this.movimientosService.logs(this.requireIglesiaId(user), departamentoId, general === 'true');
  }

  /**
   * Descarga los logs en .xlsx. Mismo contrato de filtro que GET logs: sin parámetros
   * descarga el consolidado de toda la iglesia; con departamentoId, solo ese departamento.
   */
  @Get('logs/exportar')
  async exportarLogs(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
    @Query('departamentoId') departamentoId?: string,
    @Query('general') general?: string,
  ): Promise<StreamableFile> {
    const buffer = await this.movimientosService.exportarLogs(
      this.requireIglesiaId(user),
      departamentoId,
      general === 'true',
    );

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="logs-auditoria.xlsx"',
    });

    return new StreamableFile(buffer);
  }

  @Get('exportar')
  async exportar(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('departamentoId') departamentoId?: string,
    @Query('general') general?: string,
  ): Promise<StreamableFile> {
    const buffer = await this.movimientosService.exportar(
      this.requireIglesiaId(user),
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      departamentoId,
      general === 'true',
    );

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="movimientos.xlsx"',
    });

    return new StreamableFile(buffer);
  }

  @Get('plantilla')
  async plantilla(
    @Query() dto: PlantillaMovimientosDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.finanzasImportService.plantilla(dto.formato);

    if (dto.formato === 'csv') {
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="plantilla-movimientos.csv"',
      });
    } else {
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="plantilla-movimientos.xlsx"',
      });
    }

    return new StreamableFile(buffer);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMovimientoDto) {
    return this.movimientosService.create(this.requireIglesiaId(user), user.sub, dto);
  }

  @Post('importar')
  @UseInterceptors(FileInterceptor('archivo', importMovimientosMulterOptions))
  importar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() archivo: Express.Multer.File,
    @Body() dto: ImportarMovimientosDto,
  ) {
    if (!archivo) {
      throw new BadRequestException('Debes adjuntar un archivo .xlsx o .csv en el campo "archivo"');
    }

    return this.finanzasImportService.importar(
      this.requireIglesiaId(user),
      user.sub,
      dto.departamentoId,
      archivo,
    );
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateMovimientoDto) {
    return this.movimientosService.update(this.requireIglesiaId(user), id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ConfirmPasswordDto,
  ): Promise<void> {
    return this.movimientosService.remove(this.requireIglesiaId(user), id, user.sub, dto);
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
