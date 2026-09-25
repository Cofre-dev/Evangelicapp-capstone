import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { ResponderPredicadorDto } from './dto/responder-predicador.dto';
import { PredicadoresService } from './predicadores.service';

/**
 * Única ruta pública de todo el backend (junto con /auth/login). Sin guards:
 * el tokenConfirmacion de un solo uso es la propia autenticación del predicador.
 * Techo por IP más bajo que el default global: son pocos predicadores por evento,
 * no hay razón para un volumen alto desde una misma IP.
 */
@Controller('agenda/predicadores')
@Throttle({ default: { limit: 20, ttl: minutes(1) } })
export class PredicadoresController {
  constructor(private readonly predicadoresService: PredicadoresService) {}

  @Get(':token')
  getInvitacion(@Param('token') token: string) {
    return this.predicadoresService.getInvitacion(token);
  }

  @Post(':token/responder')
  responder(@Param('token') token: string, @Body() dto: ResponderPredicadorDto) {
    return this.predicadoresService.responder(token, dto.respuesta);
  }
}
