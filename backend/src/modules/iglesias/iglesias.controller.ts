import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EstadoIglesia, PlanIglesia, Rol } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { ActualizarFacturacionDto } from './dto/actualizar-facturacion.dto';
import { CambiarPlanDto } from './dto/cambiar-plan.dto';
import { CreateIglesiaDto } from './dto/create-iglesia.dto';
import { IglesiasService } from './iglesias.service';
import { logoMulterOptions } from './logo-upload.config';

@Controller('iglesias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.SUPER_ADMIN)
export class IglesiasController {
  constructor(private readonly iglesiasService: IglesiasService) {}

  @Post()
  @UseInterceptors(FileInterceptor('logo', logoMulterOptions))
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateIglesiaDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    return this.iglesiasService.create(dto, user.sub, logo);
  }

  /** Listado filtrable para la página "Iglesias" del SuperAdmin — sin paginación (bajo volumen). */
  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('estado') estado?: EstadoIglesia,
    @Query('plan') plan?: PlanIglesia,
    @Query('region') region?: string,
  ) {
    return this.iglesiasService.findAll({ search, estado, plan, region });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.iglesiasService.findOne(id);
  }

  @Get(':id/historial-pagos')
  historialPagos(@Param('id') id: string) {
    return this.iglesiasService.historialPagos(id);
  }

  @Patch(':id/plan')
  cambiarPlan(@Param('id') id: string, @Body() dto: CambiarPlanDto) {
    return this.iglesiasService.cambiarPlan(id, dto);
  }

  @Patch(':id/facturacion')
  actualizarFacturacion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ActualizarFacturacionDto,
  ) {
    return this.iglesiasService.actualizarFacturacion(id, dto, user.sub);
  }

  @Post(':id/marcar-pagada')
  @HttpCode(HttpStatus.OK)
  marcarPagada(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.iglesiasService.marcarPagada(id, user.sub);
  }

  @Patch(':id/ocultar')
  ocultar(@Param('id') id: string) {
    return this.iglesiasService.ocultar(id);
  }

  @Patch(':id/mostrar')
  mostrar(@Param('id') id: string) {
    return this.iglesiasService.mostrar(id);
  }
}
