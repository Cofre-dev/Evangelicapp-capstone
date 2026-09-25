import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BautizosController } from './bautizos.controller';
import { BautizosService } from './bautizos.service';
import { DefuncionesController } from './defunciones.controller';
import { DefuncionesService } from './defunciones.service';
import { MatrimoniosController } from './matrimonios.controller';
import { MatrimoniosService } from './matrimonios.service';
import { PresentacionesController } from './presentaciones.controller';
import { PresentacionesService } from './presentaciones.service';

@Module({
  imports: [AuthModule],
  controllers: [MatrimoniosController, BautizosController, DefuncionesController, PresentacionesController],
  providers: [MatrimoniosService, BautizosService, DefuncionesService, PresentacionesService],
})
export class CeremoniasModule {}
