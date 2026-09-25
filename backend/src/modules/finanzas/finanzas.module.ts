import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';
import { DepartamentosController } from './departamentos.controller';
import { DepartamentosService } from './departamentos.service';
import { FinanzasImportService } from './finanzas-import.service';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';

@Module({
  imports: [AuthModule],
  controllers: [CategoriasController, DepartamentosController, MovimientosController],
  providers: [CategoriasService, DepartamentosService, MovimientosService, FinanzasImportService],
})
export class FinanzasModule {}
