import { Module } from '@nestjs/common';
import { MiIglesiaController } from './mi-iglesia.controller';
import { MiIglesiaService } from './mi-iglesia.service';

@Module({
  controllers: [MiIglesiaController],
  providers: [MiIglesiaService],
})
export class MiIglesiaModule {}
