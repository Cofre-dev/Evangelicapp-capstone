"use client";

import { TIPO_EVENTO_CHIP_CLASS, type Evento } from "./types";
import { TIMELINE_HORAS, calcularBloques } from "./timeline";

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

interface WeekViewProps {
  /** Cualquier día dentro de la semana a mostrar. */
  semana: Date;
  eventos: Evento[];
  onSlotClick: (fecha: Date) => void;
  onEventoClick: (evento: Evento) => void;
  onDayNumberClick: (fecha: Date) => void;
}

export function WeekView({ semana, eventos, onSlotClick, onEventoClick, onDayNumberClick }: WeekViewProps) {
  const inicio = startOfWeek(semana);
  const dias = Array.from({ length: 7 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
  const hoy = new Date();
  const alturaGrilla = TIMELINE_HORAS.length * 60;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <div className="min-w-[700px]">
        <div className="flex border-b border-border">
          <div className="w-16 shrink-0" />
          {dias.map((dia) => {
            const esHoy = isSameDay(dia, hoy);
            return (
              <div key={dia.toISOString()} className="flex flex-1 flex-col items-center gap-1 border-l border-border py-2">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{DIAS_SEMANA[dia.getDay()]}</span>
                <button
                  type="button"
                  onClick={() => onDayNumberClick(dia)}
                  className={
                    esHoy
                      ? "flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                      : "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  }
                >
                  {dia.getDate()}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex">
          <div className="w-16 shrink-0 border-r border-border">
            {TIMELINE_HORAS.map((h) => (
              <div key={h} className="relative h-[60px]">
                <span className="absolute -top-2 right-2 text-[11px] text-muted-foreground">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {dias.map((dia) => {
            const eventosDelDia = eventos.filter((e) => isSameDay(new Date(e.fechaInicio), dia));
            const bloques = calcularBloques(eventosDelDia);
            return (
              <div
                key={dia.toISOString()}
                role="button"
                tabIndex={0}
                onClick={() => onSlotClick(dia)}
                onKeyDown={(e) => e.key === "Enter" && onSlotClick(dia)}
                aria-label={`Crear evento el ${dia.getDate()}`}
                className="relative flex-1 cursor-pointer border-l border-border"
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
                    className={`absolute overflow-hidden rounded-md border px-1 py-0.5 text-left text-[10px] font-medium shadow-sm transition-shadow hover:shadow-md ${TIPO_EVENTO_CHIP_CLASS[evento.tipo]}`}
                    style={{
                      top: `${topPct}%`,
                      height: `${heightPct}%`,
                      left: `calc(${leftPct}% + 1px)`,
                      width: `calc(${widthPct}% - 2px)`,
                    }}
                  >
                    <p className="truncate font-semibold">{evento.titulo}</p>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
