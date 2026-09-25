import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateDepartamentoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  /** Archivar (false) conserva el historial; reactivar (true) lo vuelve a mostrar en el navbar. */
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
