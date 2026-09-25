import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { logoMulterOptions } from '../iglesias/logo-upload.config';
import { UpdateMiIglesiaDto } from './dto/update-mi-iglesia.dto';
import { MiIglesiaService } from './mi-iglesia.service';

/** Perfil de la propia iglesia: exclusivo del MANAGER (dueño del tenant). iglesiaId siempre del JWT. */
@Controller('mi-iglesia')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.MANAGER)
export class MiIglesiaController {
  constructor(private readonly miIglesiaService: MiIglesiaService) {}

  @Get()
  findOne(@CurrentUser() user: JwtPayload) {
    return this.miIglesiaService.findOne(this.requireIglesiaId(user));
  }

  /** Módulo de facturación: plan contratado, semáforo de pago y uso actual contra los topes del plan. */
  @Get('facturacion')
  findFacturacion(@CurrentUser() user: JwtPayload) {
    return this.miIglesiaService.findFacturacion(this.requireIglesiaId(user));
  }

  @Patch()
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMiIglesiaDto) {
    return this.miIglesiaService.update(this.requireIglesiaId(user), dto);
  }

  @Patch('logo')
  @UseInterceptors(FileInterceptor('logo', logoMulterOptions))
  updateLogo(@CurrentUser() user: JwtPayload, @UploadedFile() logo?: Express.Multer.File) {
    if (!logo) {
      throw new BadRequestException('Debe adjuntar un archivo de logo');
    }
    return this.miIglesiaService.updateLogo(this.requireIglesiaId(user), logo);
  }

  private requireIglesiaId(user: JwtPayload): string {
    if (!user.iglesiaId) {
      throw new ForbiddenException('El usuario no tiene una iglesia asociada');
    }
    return user.iglesiaId;
  }
}
