import { TipoMovimiento } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategoriaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(TipoMovimiento)
  tipo: TipoMovimiento;

  /** Si no se envía, la categoría queda en finanzas general (no atada a ningún departamento). */
  @IsOptional()
  @IsString()
  departamentoId?: string;
}
