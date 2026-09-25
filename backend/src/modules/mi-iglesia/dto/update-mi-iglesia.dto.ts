import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateMiIglesiaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  comuna?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  region?: string;

  @IsOptional()
  @IsString()
  direccion?: string;
}
