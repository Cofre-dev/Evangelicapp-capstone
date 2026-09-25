import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CompleteOnboardingDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellido: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsInt()
  @Min(0)
  visitantesPromedio: number;
}
