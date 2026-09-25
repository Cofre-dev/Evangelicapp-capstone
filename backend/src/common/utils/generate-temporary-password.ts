import { randomInt } from 'crypto';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALL = LETTERS + DIGITS;

/**
 * Genera una contraseña temporal legible (sin 0/O/1/l/I) que ya cumple la
 * política de /auth/change-password (min 8 caracteres, letra + número).
 * Se usa al crear cuentas con credenciales temporales (pastor, tesorero, etc).
 */
export function generateTemporaryPassword(): string {
  const chars = [LETTERS[randomInt(LETTERS.length)], DIGITS[randomInt(DIGITS.length)]];

  for (let i = 0; i < 8; i++) {
    chars.push(ALL[randomInt(ALL.length)]);
  }

  return chars.join('');
}
