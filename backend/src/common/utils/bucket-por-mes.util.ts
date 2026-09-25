export interface BucketMensual {
  /** Formato `YYYY-MM`. */
  mes: string;
  cantidad: number;
}

function claveMensual(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Primer día (UTC) del mes que arranca la ventana de `meses` meses terminando en el mes de
 * `ahora` (inclusive) — el `where: { createdAt: { gte } }` que debe acompañar a `bucketPorMes`
 * para no traer de la base de datos más filas de las que el gráfico va a usar.
 */
export function inicioVentanaMensual(meses: number, ahora: Date = new Date()): Date {
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - (meses - 1), 1));
}

/**
 * Agrupa fechas en baldes mensuales calendario (UTC), rellenando con 0 los meses sin datos.
 * Devuelve `meses` baldes ordenados del más antiguo al más reciente (el mes de `ahora` queda
 * al final) — pensado para series de tiempo en gráficos (certificados/eventos por mes, etc).
 */
export function bucketPorMes(fechas: Date[], meses: number, ahora: Date = new Date()): BucketMensual[] {
  const conteos = new Map<string, number>();
  for (const fecha of fechas) {
    const clave = claveMensual(fecha);
    conteos.set(clave, (conteos.get(clave) ?? 0) + 1);
  }

  const baldes: BucketMensual[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const fechaBalde = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - i, 1));
    const clave = claveMensual(fechaBalde);
    baldes.push({ mes: clave, cantidad: conteos.get(clave) ?? 0 });
  }

  return baldes;
}
