export interface PuntoIngresosEgresos {
  mes: string;
  ingresos: number;
  egresos: number;
}

/**
 * Dos líneas (ingresos/egresos) mes a mes — SVG a mano con
 * `preserveAspectRatio="none"`, mismo criterio que `TrendArea`
 * (`components/dashboard/trend-area.tsx`): sin librería de gráficos, sin
 * animación de dibujado, sin marcadores por punto (con esta relación de
 * aspecto tan achatada un `<circle>` se ve como una elipse — mismo motivo por
 * el que `TrendArea` tampoco los usa). Los colores replican los que ya usa el
 * resto de Finanzas para ingreso/egreso (`emerald`/`amber`, ver `StatTile` y
 * las barras de categoría que tenía `/finanzas`).
 */
export function BalanceMensualChart({ data }: { data: PuntoIngresosEgresos[] }) {
  if (data.every((d) => d.ingresos === 0 && d.egresos === 0)) {
    return <p className="text-sm text-muted-foreground">Sin movimientos este año.</p>;
  }

  const width = 100;
  const height = 44;
  const padY = 3;
  const max = Math.max(...data.map((d) => d.ingresos), ...data.map((d) => d.egresos), 1);

  function puntos(valores: number[]): string {
    return valores
      .map((v, i) => {
        const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
        const y = height - padY - (v / max) * (height - padY * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }

  return (
    <div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          Ingresos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          Egresos
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="mt-2 h-40 w-full"
        role="img"
        aria-label="Ingresos y egresos mensuales del año"
      >
        <path d={puntos(data.map((d) => d.egresos))} className="stroke-amber-500" fill="none" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <path d={puntos(data.map((d) => d.ingresos))} className="stroke-emerald-500" fill="none" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="flex">
        {data.map((d) => (
          <span key={d.mes} className="flex-1 text-center text-[10px] text-muted-foreground">
            {d.mes}
          </span>
        ))}
      </div>
    </div>
  );
}
