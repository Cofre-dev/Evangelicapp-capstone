import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EstadoTarea } from '@prisma/client';

export class UpdateNotaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  titulo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsDateString()
  fechaLimite?: string;

  @IsOptional()
  @IsString()
  asignadoAId?: string | null;

  @IsOptional()
  @IsEnum(EstadoTarea)
  estado?: EstadoTarea;
}
