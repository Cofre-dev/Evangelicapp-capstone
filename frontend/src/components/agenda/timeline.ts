import type { Evento } from "./types";

/** Grilla horaria de las vistas Día/Semana: 06:00 a 24:00 (18 filas de 1h).
 * Cubre desde cultos matutinos hasta reuniones nocturnas sin las horas de
 * madrugada, casi siempre vacías, que solo alargarían la página. */
export const TIMELINE_HORA_INICIO = 6;
export const TIMELINE_HORA_FIN = 24;
export const TIMELINE_HORAS = Array.from(
  { length: TIMELINE_HORA_FIN - TIMELINE_HORA_INICIO },
  (_, i) => TIMELINE_HORA_INICIO + i,
);

const TOTAL_MINUTOS = (TIMELINE_HORA_FIN - TIMELINE_HORA_INICIO) * 60;
const ALTURA_MIN_PCT = 3;

function minutosDesdeInicioGrid(fecha: Date): number {
  return (fecha.getHours() - TIMELINE_HORA_INICIO) * 60 + fecha.getMinutes();
}

interface EventoConMinutos {
  evento: Evento;
  inicioMin: number;
  finMin: number;
}

export interface BloqueEvento {
  evento: Evento;
  topPct: number;
  heightPct: number;
  leftPct: number;
  widthPct: number;
}

/**
 * Posiciona los eventos de un día sobre la grilla horaria como % del alto y
 * ancho del contenedor. Eventos que se solapan en el tiempo se agrupan y se
 * reparten el ancho en columnas iguales — mismo criterio visual que Google
 * Calendar, sin su algoritmo fino de columnas (acá alcanza: `evento-dialog.tsx`
 * ya avisa de choques de horario al crear/editar, así que dos eventos
 * simultáneos son la excepción, no la regla).
 */
export function calcularBloques(eventosDelDia: Evento[]): BloqueEvento[] {
  const conMinutos: EventoConMinutos[] = eventosDelDia
    .map((evento) => ({
      evento,
      inicioMin: Math.max(0, minutosDesdeInicioGrid(new Date(evento.fechaInicio))),
      finMin: Math.min(TOTAL_MINUTOS, minutosDesdeInicioGrid(new Date(evento.fechaFin))),
    }))
    .filter((e) => e.finMin > 0 && e.inicioMin < TOTAL_MINUTOS)
    .sort((a, b) => a.inicioMin - b.inicioMin);

  const grupos: EventoConMinutos[][] = [];
  let grupoActual: EventoConMinutos[] = [];
  let finMaximo = -Infinity;

  for (const ev of conMinutos) {
    if (grupoActual.length > 0 && ev.inicioMin >= finMaximo) {
      grupos.push(grupoActual);
      grupoActual = [];
      finMaximo = -Infinity;
    }
    grupoActual.push(ev);
    finMaximo = Math.max(finMaximo, ev.finMin);
  }
  if (grupoActual.length > 0) grupos.push(grupoActual);

  const bloques: BloqueEvento[] = [];
  for (const grupo of grupos) {
    const n = grupo.length;
    grupo.forEach((ev, i) => {
      const topPct = (ev.inicioMin / TOTAL_MINUTOS) * 100;
      const heightPct = Math.max(((ev.finMin - ev.inicioMin) / TOTAL_MINUTOS) * 100, ALTURA_MIN_PCT);
      bloques.push({ evento: ev.evento, topPct, heightPct, leftPct: (i / n) * 100, widthPct: 100 / n });
    });
  }
  return bloques;
}
