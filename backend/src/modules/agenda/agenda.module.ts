import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AsistenciasController } from './asistencias.controller';
import { AsistenciasService } from './asistencias.service';
import { ConvocatoriaController } from './convocatoria.controller';
import { ConvocatoriaService } from './convocatoria.service';
import { EventosController } from './eventos.controller';
import { EventosService } from './eventos.service';
import { PredicadoresController } from './predicadores.controller';
import { PredicadoresService } from './predicadores.service';

@Module({
  imports: [MailModule, WhatsAppModule, RealtimeModule],
  controllers: [EventosController, PredicadoresController, AsistenciasController, ConvocatoriaController],
  providers: [EventosService, PredicadoresService, AsistenciasService, ConvocatoriaService],
})
export class AgendaModule {}
