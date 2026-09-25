import { IsEmail, IsString, MinLength } from 'class-validator';

/** Fase 7 de docs/supabase.md: login por email (antes username), para alinear con el modelo nativo de Supabase Auth. */
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
