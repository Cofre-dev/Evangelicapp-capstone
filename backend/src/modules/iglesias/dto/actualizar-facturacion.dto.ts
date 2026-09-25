import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

/**
 * Corrección manual de la fecha de facturación (ej. el SuperAdmin se equivocó al crear
 * la iglesia). Exige reingresar la contraseña del SuperAdmin (mismo patrón que
 * `ConfirmPasswordDto`, ver IglesiasService#actualizarFacturacion) — es un cambio con
 * impacto real en cuándo se corta el acceso de una iglesia por mora, no una edición trivial.
 */
export class ActualizarFacturacionDto {
  @IsDateString()
  proximaFacturacion: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
