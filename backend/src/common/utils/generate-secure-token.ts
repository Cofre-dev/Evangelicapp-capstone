import { randomBytes } from 'crypto';

/** CSPRNG genérico (hex) para cualquier token que no deba ser predecible (CSRF, links de un solo uso, etc). */
export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
