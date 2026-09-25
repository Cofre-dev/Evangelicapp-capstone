import { IsOptional, IsString } from 'class-validator';

/**
 * Campo de texto que viaja junto al archivo en el multipart/form-data.
 * Si no se envía, todas las filas del archivo se importan a finanzas general.
 */
export class ImportarMovimientosDto {
  @IsOptional()
  @IsString()
  departamentoId?: string;
}
