import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { USERNAME_FORMAT_MESSAGE, USERNAME_REGEX } from '../../../common/utils/username';

export class CreateUsuarioDto {
  @Matches(USERNAME_REGEX, { message: USERNAME_FORMAT_MESSAGE })
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellido: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}
