import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TipoEvento } from '@prisma/client';

export class PredicadorInvitadoDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  nombre?: string;
}

export class CreateEventoDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsEnum(TipoEvento)
  tipo: TipoEvento;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsString()
  colorEtiqueta?: string;

  /** Solo tiene sentido cuando tipo = CULTO; se ignora para el resto. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PredicadorInvitadoDto)
  predicadores?: PredicadorInvitadoDto[];

  /**
   * Trigger explícito para avisar por correo a todos los Integrantes de la iglesia
   * (con RSVP + link a Google Calendar). Solo aplica al crear el evento — no existe
   * en UpdateEventoDto a propósito, para no reenviar convocatorias al editar un evento.
   */
  @IsOptional()
  @IsBoolean()
  notificarIntegrantes?: boolean;
}
