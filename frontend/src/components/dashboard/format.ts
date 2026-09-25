/**
 * `"YYYY-MM-DD"`/`"YYYY-MM"` que mandan estos endpoints son fechas ISO
 * *date-only*. `new Date(iso)` las parsea como medianoche UTC — formatearlas
 * después con `.toLocaleDateString("es-CL", ...)` en un navegador en Chile
 * (UTC-3/-4) las corre un día/mes hacia atrás. Estos helpers construyen la
 * fecha con el constructor en hora local (año, mes, día) en vez de pasarle el
 * string crudo a `Date`, que es inequívoco y no sufre ese corrimiento.
 */
function parseFechaLocal(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function parseMesLocal(mes: string): Date {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "2026-03" -> "Mar" (mismo criterio que `formatoDiaCorto` en
 * `agenda/proximos-eventos.tsx`: `toLocaleDateString` con `es-CL` agrega un
 * punto final en las abreviaturas que acá no queremos). */
export function formatMesCorto(mes: string): string {
  return capitalizar(parseMesLocal(mes).toLocaleDateString("es-CL", { month: "short" }).replace(".", ""));
}

/** "2026-08-11" -> "Lun" */
export function formatDiaSemanaCorto(fecha: string): string {
  return capitalizar(parseFechaLocal(fecha).toLocaleDateString("es-CL", { weekday: "short" }).replace(".", ""));
}

/** "2026-08-11" -> "11 ago" */
export function formatDiaCorto(fecha: string): string {
  return parseFechaLocal(fecha).toLocaleDateString("es-CL", { day: "numeric", month: "short" }).replace(".", "");
}

/** Rango legible para el eje de un `TrendArea` sin poner 30 etiquetas
 * apiladas: solo el primer y último punto de la serie. */
export function formatRangoFechas(primera: string, ultima: string): string {
  return `${formatDiaCorto(primera)} – ${formatDiaCorto(ultima)}`;
}

/** Las horas de `actividad.porHora` vienen explícitas en UTC (ver
 * frontend/prompt.md) — no se convierten a hora de Chile: un corrimiento fijo
 * sería además incorrecto dos veces al año por horario de verano, y esta
 * pantalla siempre debe mostrar la leyenda "(hora UTC)" junto al gráfico para
 * que no se lea como un olvido. */
export function formatHoraUTC(hora: number): string {
  return `${String(hora).padStart(2, "0")}h`;
}

export function formatMinutos(minutos: number): string {
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
