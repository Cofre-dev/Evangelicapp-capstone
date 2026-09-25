import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { MedioPago } from '@prisma/client';

export class CreateMovimientoDto {
  /** Tope real de la columna `monto` (Decimal(12,2) en el schema): hasta 10 dígitos enteros. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  monto: number;

  /** El tipo (INGRESO/EGRESO) del movimiento se toma de la categoría, no del cliente. */
  @IsString()
  @IsNotEmpty()
  categoriaId: string;

  @IsDateString()
  fecha: string;

  /** Obligatoria: transparencia de en qué consiste cada movimiento. */
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsEnum(MedioPago)
  medioPago: MedioPago;

  /**
   * Si no se envía, el movimiento queda en finanzas general. Inmutable tras la creación
   * (no existe en UpdateMovimientoDto): si se registró en el destino equivocado, se borra
   * y se recrea, en vez de permitir mover plata entre libros por una edición.
   */
  @IsOptional()
  @IsString()
  departamentoId?: string;
}
