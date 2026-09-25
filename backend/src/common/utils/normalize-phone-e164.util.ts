const CHILE_MOVIL_REGEX = /^9\d{8}$/;
const CHILE_CON_CODIGO_REGEX = /^56\d{9}$/;
const E164_REGEX = /^\+\d{8,15}$/;

/**
 * Meta exige E.164 (+56912345678) para mandar plantillas de WhatsApp. `Integrante.telefono`
 * es texto libre a nivel de columna (sin formato forzado), así que puede venir con espacios,
 * guiones, el "+56" ya puesto o sin él. Devuelve null si no se puede normalizar en vez de
 * lanzar — el llamador debe saltear solo ese envío puntual, no romper el resto del batch.
 */
export function normalizarTelefonoE164(telefono: string): string | null {
  const limpio = telefono.trim().replace(/[\s()-]/g, '');

  if (E164_REGEX.test(limpio)) {
    return limpio;
  }

  if (CHILE_MOVIL_REGEX.test(limpio)) {
    return `+56${limpio}`;
  }

  if (CHILE_CON_CODIGO_REGEX.test(limpio)) {
    return `+${limpio}`;
  }

  return null;
}
