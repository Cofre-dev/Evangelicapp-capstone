"use client";

import { TIPO_EVENTO_CHIP_CLASS, type Evento } from "./types";

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const start = new Date(year, month, 1 - startWeekday);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface MonthCalendarProps {
  /** Cualquier fecha dentro del mes que se debe mostrar. */
  mes: Date;
  eventos: Evento[];
  onDayClick: (date: Date) => void;
  onEventoClick: (evento: Evento) => void;
  /** Click en el número del día (no en el resto de la celda) — navega al
   * detalle de ese día, mismo comportamiento que Google Calendar: clickear el
   * número te lleva a la vista Día, clickear el resto de la celda crea un
   * evento ahí (`onDayClick`, sin tocar). */
  onDayNumberClick: (date: Date) => void;
}

export function MonthCalendar({ mes, eventos, onDayClick, onEventoClick, onDayNumberClick }: MonthCalendarProps) {
  const dias = buildMonthGrid(mes.getFullYear(), mes.getMonth());
  const hoy = new Date();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="p-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((dia, i) => {
          const enMesActual = dia.getMonth() === mes.getMonth();
          const esHoy = isSameDay(dia, hoy);
          const eventosDelDia = eventos.filter((e) => isSameDay(new Date(e.fechaInicio), dia));

          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => onDayClick(dia)}
              onKeyDown={(e) => e.key === "Enter" && onDayClick(dia)}
              className={[
                "flex min-h-[96px] cursor-pointer flex-col items-stretch gap-1 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-muted/50",
                i % 7 === 6 ? "border-r-0" : "",
                enMesActual ? "" : "bg-muted/30",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDayNumberClick(dia);
                }}
                aria-label={`Ver el día ${dia.getDate()}`}
                className={
                  esHoy
                    ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                    : `w-fit text-xs font-medium hover:underline ${enMesActual ? "text-foreground" : "text-muted-foreground"}`
                }
              >
                {dia.getDate()}
              </button>

              <div className="flex flex-col gap-1">
                {eventosDelDia.slice(0, 3).map((evento) => (
                  <span
                    key={evento.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventoClick(evento);
                    }}
                    className={`truncate rounded border px-1.5 py-0.5 text-[11px] font-medium ${TIPO_EVENTO_CHIP_CLASS[evento.tipo]}`}
                  >
                    {evento.titulo}
                  </span>
                ))}
                {eventosDelDia.length > 3 && (
                  <span className="text-[11px] text-muted-foreground">+{eventosDelDia.length - 3} más</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
