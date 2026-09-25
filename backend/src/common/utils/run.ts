const RUN_REGEX = /^(\d{7,8})-([0-9kK])$/;

export function esRunValido(run: string): boolean {
  const match = RUN_REGEX.exec(run.trim());
  if (!match) return false;

  const [, cuerpo, dv] = match;
  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  const dvEsperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);

  return dv.toUpperCase() === dvEsperado;
}

/**
 * `12345678-k` y `12345678-K` son el mismo RUN pero, sin normalizar, quedarían
 * como valores distintos a nivel de columna — rompiendo la deduplicación por
 * `run` (@@unique y el findFirst en integrantes.service.ts comparan el string
 * tal cual). Se aplica antes de validar/guardar, nunca después.
 */
export function normalizarRun(run: string): string {
  const match = RUN_REGEX.exec(run.trim());
  if (!match) {
    return run.trim();
  }

  const [, cuerpo, dv] = match;
  return `${cuerpo}-${dv.toUpperCase()}`;
}
