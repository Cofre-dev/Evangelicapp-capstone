import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { MedioPago } from '@prisma/client';

/** No incluye `departamentoId` a propósito: es inmutable tras crear el movimiento (ver CreateMovimientoDto). */
export class UpdateMovimientoDto {
  /** Tope real de la columna `monto` (Decimal(12,2) en el schema): hasta 10 dígitos enteros. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  monto?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoriaId?: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  /** Si se envía, no puede quedar vacía: la descripción es obligatoria. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  descripcion?: string;

  @IsOptional()
  @IsEnum(MedioPago)
  medioPago?: MedioPago;
}
