/**
 * Costo compartido de bcrypt para todo el hasheo de contraseñas del sistema.
 * Subido de 10 a 12 (2026-07-12): el dato es real (personas, no un demo), y
 * el costo extra de cómputo por login/hash es aceptable para el volumen actual.
 */
export const BCRYPT_ROUNDS = 12;
