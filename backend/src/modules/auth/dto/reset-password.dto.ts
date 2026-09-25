import { IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /** El token del link del email (hex de generateSecureToken). */
  @IsString()
  @MinLength(1)
  token: string;

  // Misma política que ChangePasswordDto.newPassword — mantener ambas en sync.
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/(?=.*[a-zA-Z])(?=.*[0-9])/, {
    message: 'La contraseña debe incluir al menos una letra y un número',
  })
  newPassword: string;
}
