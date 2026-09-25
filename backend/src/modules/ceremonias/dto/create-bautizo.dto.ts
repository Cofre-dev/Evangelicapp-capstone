import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateBautizoDto {
  @IsDateString()
  fecha: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombrePersona: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombrePastor: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ciudad: string;
}
