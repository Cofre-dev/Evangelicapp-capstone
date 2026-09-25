import { ForbiddenException } from '@nestjs/common';

/**
 * Lanzada tanto en el login (AuthService#validateUser) como en cada request
 * autenticado (JwtAuthGuard#canActivate) cuando la iglesia del usuario está oculta por
 * mora (`EstadoIglesia.SUSPENDIDA`). El `code` es lo que el frontend usa para
 * distinguir este 403 de cualquier otro y mostrar la pantalla de mora en vez de un
 * error genérico (ver prompt.md).
 */
export class IglesiaSuspendidaException extends ForbiddenException {
  constructor(diasEnMora: number) {
    super({
      statusCode: 403,
      code: 'IGLESIA_SUSPENDIDA',
      message: 'La iglesia tiene la mensualidad pendiente de pago.',
      diasEnMora,
    });
  }
}
