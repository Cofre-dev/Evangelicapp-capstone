import { PlanIglesia } from '@prisma/client';
import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { USERNAME_FORMAT_MESSAGE, USERNAME_REGEX } from '../../../common/utils/username';

export class CreateIglesiaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  // Sin @default en el schema a propósito (ver prisma/schema.prisma#Iglesia): toda
  // iglesia elige su plan al crearse, no hay un plan "por defecto" implícito.
  @IsEnum(PlanIglesia)
  plan: PlanIglesia;

  /**
   * Fecha en que la iglesia adquirió el plan (ISO 8601, ej. "2026-08-10"). La primera
   * `proximaFacturacion` se calcula sola: esta fecha + 30 días (ver
   * IglesiasService#create) — el SuperAdmin ya no la elige a mano.
   */
  @IsDateString()
  fechaAdquisicionPlan: string;

  @IsString()
  @IsNotEmpty()
  comuna: string;

  @IsString()
  @IsNotEmpty()
  region: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  // El pastor se crea junto con la iglesia: es el dueño del tenant y no
  // tiene sentido una iglesia sin nadie a cargo.
  @Matches(USERNAME_REGEX, { message: USERNAME_FORMAT_MESSAGE })
  pastorUsername: string;

  @IsEmail()
  pastorEmail: string;

  @IsString()
  @IsNotEmpty()
  pastorNombre: string;

  @IsString()
  @IsNotEmpty()
  pastorApellido: string;
}
