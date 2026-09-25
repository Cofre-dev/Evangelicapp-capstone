import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { IntegrantesController } from './integrantes.controller';
import { IntegrantesRegistroController } from './integrantes-registro.controller';
import { IntegrantesService } from './integrantes.service';

@Module({
  imports: [RealtimeModule],
  controllers: [IntegrantesController, IntegrantesRegistroController],
  providers: [IntegrantesService],
})
export class IntegrantesModule {}
