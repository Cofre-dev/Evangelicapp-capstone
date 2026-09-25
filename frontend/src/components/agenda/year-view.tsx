"use client";

import type { Evento } from "./types";

const MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DIAS_SEMANA_INICIAL = ["D", "L", "M", "M", "J", "V", "S"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const start = new Date(year, month, 1 - startWeekday);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

interface MiniMesProps {
  year: number;
  month: number;
  /** Solo los días del mes que tienen al menos un evento — evita recorrer
   * todo `eventos` (el año completo) 42 veces por cada uno de los 12 meses. */
  diasConEvento: Set<number>;
  onMesClick: (fecha: Date) => void;
  onDiaClick: (fecha: Date) => void;
}

function MiniMes({ year, month, diasConEvento, onMesClick, onDiaClick }: MiniMesProps) {
  const dias = buildMonthGrid(year, month);
  const hoy = new Date();

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <button
        type="button"
        onClick={() => onMesClick(new Date(year, month, 1))}
        className="mb-2 text-sm font-semibold text-foreground transition-colors hover:text-primary"
      >
        {MESES_CORTO[month]}
      </button>
      <div className="grid grid-cols-7 gap-y-1">
        {DIAS_SEMANA_INICIAL.map((d, i) => (
          <span key={i} className="text-center text-[10px] font-medium text-muted-foreground">
            {d}
          </span>
        ))}
        {dias.map((dia, i) => {
          const enMes = dia.getMonth() === month;
          const esHoy = enMes && isSameDay(dia, hoy);
          const tieneEvento = enMes && diasConEvento.has(dia.getDate());

          return (
            <button
              key={i}
              type="button"
              onClick={() => onDiaClick(dia)}
              disabled={!enMes}
              className={[
                "relative mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                !enMes
                  ? "cursor-default text-transparent"
                  : esHoy
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "text-foreground transition-colors hover:bg-muted",
              ].join(" ")}
            >
              {dia.getDate()}
              {tieneEvento && !esHoy && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface YearViewProps {
  anio: number;
  eventos: Evento[];
  onMesClick: (fecha: Date) => void;
  onDiaClick: (fecha: Date) => void;
}

export function YearView({ anio, eventos, onMesClick, onDiaClick }: YearViewProps) {
  const diasConEventoPorMes: Set<number>[] = Array.from({ length: 12 }, () => new Set<number>());
  for (const evento of eventos) {
    const inicio = new Date(evento.fechaInicio);
    if (inicio.getFullYear() !== anio) continue;
    diasConEventoPorMes[inicio.getMonth()].add(inicio.getDate());
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => (
        <MiniMes key={m} year={anio} month={m} diasConEvento={diasConEventoPorMes[m]} onMesClick={onMesClick} onDiaClick={onDiaClick} />
      ))}
    </div>
  );
}
