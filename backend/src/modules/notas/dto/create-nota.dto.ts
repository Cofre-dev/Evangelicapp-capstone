import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TipoNota } from '@prisma/client';

export class CreateNotaDto {
  @IsOptional()
  @IsEnum(TipoNota)
  tipo?: TipoNota;

  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsDateString()
  fechaLimite?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  asignadoAId?: string;
}
