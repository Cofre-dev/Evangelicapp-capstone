import { Module } from '@nestjs/common';
import { AccesosController } from './accesos.controller';
import { AccesosService } from './accesos.service';

@Module({
  controllers: [AccesosController],
  providers: [AccesosService],
})
export class AccesosModule {}
