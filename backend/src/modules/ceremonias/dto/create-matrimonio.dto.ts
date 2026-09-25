import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateMatrimonioDto {
  @IsDateString()
  fecha: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombreNovio: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombreNovia: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombrePastor: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ciudad: string;
}
