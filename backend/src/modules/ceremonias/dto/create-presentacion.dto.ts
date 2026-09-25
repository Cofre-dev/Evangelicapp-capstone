import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePresentacionDto {
  @IsDateString()
  fecha: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombreNino: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombrePadres: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombrePastor: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ciudad: string;
}
