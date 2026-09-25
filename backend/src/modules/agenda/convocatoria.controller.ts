import { Controller, Get, Param } from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { ConvocatoriaService } from './convocatoria.service';

/**
 * Ruta pública (junto con `agenda/predicadores/:token`, `agenda/asistencias/:token`,
 * `integrantes/registro/:qrToken` y la recuperación de contraseña). Sin guards: el
 * `:token` es el `tokenConfirmacion` del propio destinatario del correo (asistencia
 * o predicador), y solo sirve para resolver de qué evento es. No muta nada.
 */
@Controller('agenda/convocatoria')
@Throttle({ default: { limit: 60, ttl: minutes(1) } })
export class ConvocatoriaController {
  constructor(private readonly convocatoriaService: ConvocatoriaService) {}

  /** Estado actual: predicadores + integrantes, con su confirmación/rechazo. */
  @Get(':token/estado')
  getEstado(@Param('token') token: string) {
    return this.convocatoriaService.getEstado(token);
  }

  /** Token de Supabase Realtime para que la página se actualice en vivo. */
  @Get(':token/realtime')
  getRealtimeToken(@Param('token') token: string) {
    return this.convocatoriaService.getRealtimeToken(token);
  }
}
