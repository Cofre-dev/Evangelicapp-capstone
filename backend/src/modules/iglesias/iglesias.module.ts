import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { FacturacionRecordatoriosCron } from './facturacion-recordatorios.cron';
import { IglesiasController } from './iglesias.controller';
import { IglesiasService } from './iglesias.service';

@Module({
  imports: [AuthModule, MailModule, RealtimeModule],
  controllers: [IglesiasController],
  providers: [IglesiasService, FacturacionRecordatoriosCron],
})
export class IglesiasModule {}
