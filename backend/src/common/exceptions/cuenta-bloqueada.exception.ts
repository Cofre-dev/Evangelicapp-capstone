import { ForbiddenException } from '@nestjs/common';

/**
 * Lanzada por AuthService#validateUser cuando la cuenta está bloqueada
 * temporalmente por intentos de login fallidos (3 seguidos → 10 min). El `code`
 * lo usa el frontend para mostrar el mensaje de bloqueo con la cuenta atrás en
 * vez de "credenciales inválidas" genérico (ver prompt.md).
 *
 * Es un 403, no un 401: un 401 el frontend lo trata como "sesión inválida" y
 * limpia todo. Además, un bloqueo por definición revela que la cuenta existe —
 * es inherente al mecanismo, no una fuga extra respecto a lo que ya se sabe al
 * poder bloquearla.
 */
export class CuentaBloqueadaException extends ForbiddenException {
  constructor(minutosRestantes: number) {
    super({
      statusCode: 403,
      code: 'CUENTA_BLOQUEADA',
      message: `Demasiados intentos fallidos. Volvé a intentar en ${minutosRestantes} ${
        minutosRestantes === 1 ? 'minuto' : 'minutos'
      }, o restablecé tu contraseña.`,
      minutosRestantes,
    });
  }
}
