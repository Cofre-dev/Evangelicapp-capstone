import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

/**
 * auth/refresh está exento de CsrfMiddleware (ver app.module.ts) porque es el
 * endpoint que le da al frontend un csrfToken nuevo cuando perdió el que tenía
 * en memoria — exigirle el header sería un candado que pide su propia llave.
 * Pero las cookies de auth usan SameSite=None en producción (frontend y
 * backend en dominios distintos), así que sin ningún control adicional un
 * atacante podría lograr que el navegador de la víctima mande un POST
 * cross-site a este endpoint con su cookie refresh_token adjunta
 * automáticamente (blind CSRF: no necesita leer la respuesta, solo que la
 * víctima cargue una página bajo su control). En el peor caso, eso puede
 * chocar contra un refresh legítimo y disparar la detección de reuso, forzando
 * el logout de todas las sesiones de la víctima.
 *
 * El navegador no permite falsificar el header Origin en una request
 * cross-site, así que validarlo contra la misma whitelist de CORS_ORIGIN
 * cierra ese hueco sin reintroducir el deadlock que motivó eximir CSRF acá.
 * Asume que todo caller legítimo es un navegador (fetch/XHR desde el
 * frontend) — un futuro cliente sin navegador (app nativa, llamada
 * server-to-server) necesitaría otro mecanismo.
 */
@Injectable()
export class RefreshOriginMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const allowedOrigins = (this.config.get<string>('CORS_ORIGIN') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    const origin = req.headers.origin;

    if (!origin || !allowedOrigins.includes(origin)) {
      throw new ForbiddenException('Origen no permitido');
    }

    next();
  }
}
