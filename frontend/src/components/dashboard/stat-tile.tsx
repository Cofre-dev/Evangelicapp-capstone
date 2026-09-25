import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<"default" | "positive" | "negative" | "accent", string> = {
  default: "text-foreground",
  positive: "text-emerald-600",
  negative: "text-amber-600",
  accent: "text-chart-accent",
};

/**
 * Generaliza los dos `StatTile` casi-duplicados que existían en
 * `superadmin/page.tsx` y `finanzas/page.tsx`. `value` llega ya formateado
 * por quien llama (mismo criterio que `ProximosEventos`, que recibe datos ya
 * listos para pintar) — este componente no sabe de `Intl.NumberFormat` ni de
 * CLP ni de minutos, solo de layout. `variant="display"` es el gesto
 * tipográfico deliberado del rediseño (ver frontend/prompt.md): números
 * grandes en `font-display` (Playfair, sin cursiva — la cursiva de la app es
 * para saludos, no para números tabulares) en vez del bold-sans genérico.
 */
export function StatTile({
  label,
  value,
  tone = "default",
  variant = "sans",
  icon: Icon,
  helpText,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "accent";
  variant?: "sans" | "display";
  icon?: ComponentType<{ className?: string }>;
  helpText?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </div>
      <p
        className={cn(
          "mt-2 tabular-nums",
          variant === "display" ? "font-display text-3xl" : "text-3xl font-semibold",
          TONE_CLASSES[tone],
        )}
      >
        {value}
      </p>
      {helpText && <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}
