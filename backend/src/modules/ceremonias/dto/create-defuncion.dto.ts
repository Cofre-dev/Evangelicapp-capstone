import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDefuncionDto {
  @IsDateString()
  fecha: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombreDifunto: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombrePastor: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ciudad: string;
}
