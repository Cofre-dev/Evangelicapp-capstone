import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, minutes } from '@nestjs/throttler';
import { RegistrarIntegranteDto } from './dto/registrar-integrante.dto';
import { integranteFotoMulterOptions } from './foto-upload.config';
import { IntegrantesService } from './integrantes.service';

/**
 * Landing pública del QR de la iglesia (censo de integrantes). Sin guards:
 * el qrToken de la URL es la propia autenticación, igual que
 * PredicadoresController con su tokenConfirmacion. Techo por IP generoso a
 * propósito: durante un evento real, mucha gente puede escanear el mismo QR
 * desde el mismo wifi (misma IP pública tras el NAT de la iglesia).
 */
@Controller('integrantes/registro')
@Throttle({ default: { limit: 40, ttl: minutes(1) } })
export class IntegrantesRegistroController {
  constructor(private readonly integrantesService: IntegrantesService) {}

  @Get(':qrToken')
  getInvitacion(@Param('qrToken') qrToken: string) {
    return this.integrantesService.getInvitacion(qrToken);
  }

  @Post(':qrToken')
  @UseInterceptors(FileInterceptor('foto', integranteFotoMulterOptions))
  registrar(
    @Param('qrToken') qrToken: string,
    @Body() dto: RegistrarIntegranteDto,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    return this.integrantesService.registrar(qrToken, dto, foto);
  }
}
