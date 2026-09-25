"use client";

import { TIPO_EVENTO_CHIP_CLASS, type Evento } from "./types";
import { TIMELINE_HORAS, calcularBloques } from "./timeline";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface DayViewProps {
  dia: Date;
  eventos: Evento[];
  onSlotClick: (fecha: Date) => void;
  onEventoClick: (evento: Evento) => void;
}

export function DayView({ dia, eventos, onSlotClick, onEventoClick }: DayViewProps) {
  const eventosDelDia = eventos.filter((e) => isSameDay(new Date(e.fechaInicio), dia));
  const bloques = calcularBloques(eventosDelDia);
  const alturaGrilla = TIMELINE_HORAS.length * 60;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex min-w-[420px]">
        <div className="w-16 shrink-0 border-r border-border">
          {TIMELINE_HORAS.map((h) => (
            <div key={h} className="relative h-[60px]">
              <span className="absolute -top-2 right-2 text-[11px] text-muted-foreground">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSlotClick(dia)}
          onKeyDown={(e) => e.key === "Enter" && onSlotClick(dia)}
          aria-label="Crear evento este día"
          className="relative flex-1 cursor-pointer"
          style={{ height: alturaGrilla }}
        >
          {TIMELINE_HORAS.map((h, i) => (
            <div key={h} className="absolute left-0 right-0 border-t border-border" style={{ top: i * 60 }} />
          ))}

          {bloques.map(({ evento, topPct, heightPct, leftPct, widthPct }) => (
            <button
              key={evento.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEventoClick(evento);
              }}
              className={`absolute overflow-hidden rounded-lg border px-2 py-1 text-left text-[11px] font-medium shadow-sm transition-shadow hover:shadow-md ${TIPO_EVENTO_CHIP_CLASS[evento.tipo]}`}
              style={{
                top: `${topPct}%`,
                height: `${heightPct}%`,
                left: `calc(${leftPct}% + 2px)`,
                width: `calc(${widthPct}% - 4px)`,
              }}
            >
              <p className="truncate font-semibold">{evento.titulo}</p>
              <p className="truncate opacity-80">
                {new Date(evento.fechaInicio).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
