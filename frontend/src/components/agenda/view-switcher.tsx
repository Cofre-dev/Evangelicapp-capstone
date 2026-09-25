"use client";

export type VistaAgenda = "dia" | "semana" | "mes" | "anio";

const OPCIONES: { value: VistaAgenda; label: string }[] = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
  { value: "anio", label: "Año" },
];

export function ViewSwitcher({ vista, onChange }: { vista: VistaAgenda; onChange: (vista: VistaAgenda) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
      {OPCIONES.map((op) => (
        <button
          key={op.value}
          type="button"
          onClick={() => onChange(op.value)}
          aria-pressed={vista === op.value}
          className={
            vista === op.value
              ? "rounded-lg bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm"
              : "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          {op.label}
        </button>
      ))}
    </div>
  );
}
