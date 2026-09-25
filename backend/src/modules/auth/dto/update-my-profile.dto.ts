import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  apellido?: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}
