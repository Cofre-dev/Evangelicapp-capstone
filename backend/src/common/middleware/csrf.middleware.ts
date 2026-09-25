import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE, REFRESH_TOKEN_COOKIE } from '../constants/auth-cookies';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit cookie: si la request ya trae una cookie de sesión (access o
 * refresh token), exige que el header X-CSRF-Token coincida con la cookie
 * csrf_token (legible por JS a propósito). Sin cookie de sesión no hay nada
 * que proteger, así que login y las rutas públicas de predicadores (ver
 * exclusiones en AppModule) quedan exentas sin necesidad de lógica extra acá.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (!MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const hasSessionCookie = Boolean(cookies?.[ACCESS_TOKEN_COOKIE] ?? cookies?.[REFRESH_TOKEN_COOKIE]);

    if (!hasSessionCookie) {
      next();
      return;
    }

    const csrfCookie = cookies?.[CSRF_COOKIE];
    const csrfHeader = req.headers[CSRF_HEADER];

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new ForbiddenException('Token CSRF inválido o ausente');
    }

    next();
  }
}
