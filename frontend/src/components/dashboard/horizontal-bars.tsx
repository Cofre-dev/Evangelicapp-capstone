/**
 * Generaliza `RegionBars` (antes en `superadmin/page.tsx`) y `CategoriaBars`
 * (en `finanzas/page.tsx`, sin tocar — fuera de las 3 pantallas del brief).
 * Mismo guard `Math.max(...valores, 1)` contra división por cero y
 * `Math.max(pct, 4)` de ancho mínimo visible que los originales. Como el
 * label y el valor son texto real (no SVG), no necesita tratamiento de
 * accesibilidad especial: un lector de pantalla ya los recorre línea por
 * línea igual que cualquier lista.
 */
export function HorizontalBars({
  data,
  colorClass = "bg-primary",
  valueFormatter = (v: number) => v.toLocaleString("es-CL"),
  emptyMessage = "Sin datos por ahora.",
  /** `w-16` alcanza para contadores cortos ("162"), pero se queda corto con
   * montos formateados en pesos ("$1.234.567") — sobreescribible por quien
   * llama en vez de agrandar el default y afectar a todos los usos actuales
   * (todos con contadores). Clase estática a propósito (no template
   * dinámico): Tailwind necesita verla escrita literal en el código fuente
   * de quien la pasa para no purgarla en build. */
  valueWidthClass = "w-16",
}: {
  data: { label: string; value: number }[];
  colorClass?: string;
  valueFormatter?: (value: number) => string;
  emptyMessage?: string;
  valueWidthClass?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm text-foreground" title={d.label}>
            {d.label}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${colorClass}`}
              style={{ width: `${Math.max((d.value / max) * 100, 4)}%` }}
            />
          </div>
          <span className={`${valueWidthClass} shrink-0 text-right text-sm font-medium tabular-nums text-foreground`}>
            {valueFormatter(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
