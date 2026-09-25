const TONE_CLASSES: Record<"accent" | "primary", { stroke: string; fill: string }> = {
  accent: { stroke: "stroke-chart-accent", fill: "fill-chart-accent/15" },
  primary: { stroke: "stroke-primary", fill: "fill-primary/15" },
};

/**
 * Línea/área SVG para series de tiempo cortas (`actividad.porDia`, 30 puntos;
 * `personal.tiempoPorDia`, 7 puntos) — mismo componente para ambas, solo
 * cambia la cantidad de puntos que le pasa quien llama. `tone="accent"` (el
 * default) es el canal visual dedicado a tiempo/actividad del rediseño (ver
 * frontend/prompt.md) — no se usa para otra cosa en la app.
 *
 * `viewBox` proporcional + `preserveAspectRatio="none"`, dimensionado por CSS
 * (`w-full h-24` en quien llama) en vez de medir con JS: evita el layout-read
 * en render que marca el checklist de interfaz web (getBoundingClientRect y
 * similares). Sin animación de dibujado deliberadamente — la skill de diseño
 * advierte que el motion de más es justamente lo que hace sentir "generado
 * por IA" a un dashboard; acá el dato ya es la historia.
 */
export function TrendArea({
  data,
  tone = "accent",
  ariaLabel,
  caption,
}: {
  data: { fecha: string; value: number }[];
  tone?: "accent" | "primary";
  ariaLabel: string;
  caption?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos por ahora.</p>;
  }

  const width = 100;
  const height = 40;
  const padY = 3;
  const max = Math.max(...data.map((d) => d.value), 1);

  const puntos = data.map((d, i) => {
    const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
    const y = height - padY - (d.value / max) * (height - padY * 2);
    return { x, y };
  });

  const lineaD = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const areaD = `${lineaD} L${width},${height} L0,${height} Z`;

  const { stroke, fill } = TONE_CLASSES[tone];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-24 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <path d={areaD} className={fill} stroke="none" />
        <path d={lineaD} className={stroke} fill="none" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}
