import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService, ValidatedLogin } from '../auth.service';

/**
 * Se usa solo en POST /auth/login (vía LocalAuthGuard). `usernameField` es el
 * nombre que Passport espera por defecto para "el campo identificador" — acá
 * apunta a `email` (Fase 7 de docs/supabase.md: login por email, no por
 * username, para alinear con el modelo nativo de Supabase Auth).
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string): Promise<ValidatedLogin> {
    return this.authService.validateUser(email, password);
  }
}
