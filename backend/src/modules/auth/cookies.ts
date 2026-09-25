import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import ms from 'ms';
import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE, REFRESH_TOKEN_COOKIE } from '../../common/constants/auth-cookies';

export interface AuthCookiePayload {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

function isProduction(config: ConfigService): boolean {
  return config.get<string>('NODE_ENV') === 'production';
}

/**
 * accessToken y refreshToken van en cookies httpOnly (no legibles por JS,
 * inmunes a robo vía XSS). csrfToken va en una cookie NO httpOnly a propósito:
 * el frontend debe leerla y reflejarla en el header X-CSRF-Token en cada
 * request mutante (ver CsrfMiddleware). El refreshToken además restringe su
 * Path a /auth/refresh: el navegador no lo manda en ninguna otra request.
 */
export function setAuthCookies(res: Response, config: ConfigService, payload: AuthCookiePayload): void {
  const secure = isProduction(config);
  // Frontend y backend viven en dominios distintos (ej. Vercel + Render), lo que hace la
  // request cross-site: SameSite=Lax no viaja en fetch/XHR cross-site, así que en producción
  // se necesita 'none' (que a su vez exige Secure, ya cubierto por `secure` en producción).
  const sameSite = secure ? 'none' : 'lax';
  const accessMaxAge = ms(config.get<string>('JWT_ACCESS_EXPIRATION', '15m') as ms.StringValue);
  const refreshMaxAge = ms(config.get<string>('JWT_REFRESH_EXPIRATION', '7d') as ms.StringValue);

  res.cookie(ACCESS_TOKEN_COOKIE, payload.accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: accessMaxAge,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, payload.refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/auth/refresh',
    maxAge: refreshMaxAge,
  });

  res.cookie(CSRF_COOKIE, payload.csrfToken, {
    httpOnly: false,
    secure,
    sameSite,
    path: '/',
    maxAge: refreshMaxAge,
  });
}

/** Los atributos (path, sameSite, secure) deben calzar exactos con los de setAuthCookies para que el navegador borre las cookies correctas. */
export function clearAuthCookies(res: Response, config: ConfigService): void {
  const secure = isProduction(config);
  const sameSite = secure ? 'none' : 'lax';

  res.clearCookie(ACCESS_TOKEN_COOKIE, { httpOnly: true, secure, sameSite, path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/auth/refresh',
  });
  res.clearCookie(CSRF_COOKIE, { httpOnly: false, secure, sameSite, path: '/' });
}
