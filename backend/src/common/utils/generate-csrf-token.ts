import { generateSecureToken } from './generate-secure-token';

/** Token opaco para el patrón double-submit cookie (no es un JWT, no lleva información). */
export function generateCsrfToken(): string {
  return generateSecureToken();
}
