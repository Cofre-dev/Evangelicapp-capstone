/**
 * Un solo componente para "N barras verticales con un label chico debajo",
 * reusado para `certificados.porMes`/`eventosPorMes` (6 puntos, todos con
 * label) y `actividad.porHora` (24 puntos — `labelEvery` para no apilar 24
 * etiquetas, ver uso en el dashboard de SuperAdmin). Mismo guard de división
 * por cero y alto mínimo visible que `HorizontalBars`. Es una figura
 * compuesta sin texto real por barra, así que sí necesita un resumen
 * accesible (`ariaLabel`) — mismo criterio que un ícono decorativo-pero-
 * informativo del checklist de Vercel.
 */
export function VerticalBars({
  data,
  colorClass = "bg-primary",
  labelEvery = 1,
  ariaLabel,
  emptyMessage = "Sin datos por ahora.",
}: {
  data: { label: string; value: number }[];
  colorClass?: string;
  labelEvery?: number;
  ariaLabel: string;
  emptyMessage?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div role="img" aria-label={ariaLabel} className="flex items-end gap-1">
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-24 w-full items-end overflow-hidden rounded-t bg-muted/40">
            <div
              className={`w-full rounded-t ${colorClass}`}
              style={{ height: `${Math.max((d.value / max) * 100, 4)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{i % labelEvery === 0 ? d.label : " "}</span>
        </div>
      ))}
    </div>
  );
}
