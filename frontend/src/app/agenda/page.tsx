"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DayView } from "@/components/agenda/day-view";
import { EventoDialog } from "@/components/agenda/evento-dialog";
import { MonthCalendar } from "@/components/agenda/month-calendar";
import type { Evento } from "@/components/agenda/types";
import { ViewSwitcher, type VistaAgenda } from "@/components/agenda/view-switcher";
import { WeekView } from "@/components/agenda/week-view";
import { YearView } from "@/components/agenda/year-view";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { ApiError, apiFetch } from "@/lib/api";
import type { SessionUser } from "@/stores/auth-store";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// AGENDA es uno de los 4 módulos delegables (ver frontend/prompt.md): el
// MANAGER siempre tiene acceso; un USUARIO solo si el MANAGER se lo otorgó
// desde /accesos.
function tieneAccesoAgenda(usuario: SessionUser): boolean {
  return usuario.rol === "MANAGER" || usuario.modulos.includes("AGENDA");
}

function startOfWeek(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Rango a pedirle a `/agenda/eventos` para cada vista. El de "mes" mantiene
 * el padding de ±7 días que ya tenía (para que las semanas de borde de la
 * grilla de 6 filas de `MonthCalendar` no queden vacías). */
function rangoParaVista(vista: VistaAgenda, fecha: Date): { from: Date; to: Date } {
  if (vista === "dia") {
    return {
      from: new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
      to: new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59),
    };
  }
  if (vista === "semana") {
    const from = startOfWeek(fecha);
    return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59) };
  }
  if (vista === "anio") {
    return { from: new Date(fecha.getFullYear(), 0, 1), to: new Date(fecha.getFullYear(), 11, 31, 23, 59, 59) };
  }
  return { from: new Date(fecha.getFullYear(), fecha.getMonth(), 1 - 7), to: new Date(fecha.getFullYear(), fecha.getMonth() + 1, 7) };
}

function avanzar(vista: VistaAgenda, fecha: Date, direccion: 1 | -1): Date {
  if (vista === "dia") return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + direccion);
  if (vista === "semana") return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 7 * direccion);
  if (vista === "anio") return new Date(fecha.getFullYear() + direccion, fecha.getMonth(), 1);
  return new Date(fecha.getFullYear(), fecha.getMonth() + direccion, 1);
}

function etiquetaPeriodo(vista: VistaAgenda, fecha: Date): string {
  if (vista === "dia") {
    const texto = fecha.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  if (vista === "semana") {
    const { from, to } = rangoParaVista("semana", fecha);
    if (from.getMonth() === to.getMonth()) {
      return `${from.getDate()} – ${to.getDate()} de ${MESES[from.getMonth()]} ${from.getFullYear()}`;
    }
    const corta = (d: Date) => `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3).toLowerCase()}`;
    return `${corta(from)} – ${corta(to)} ${to.getFullYear()}`;
  }
  if (vista === "anio") return `${fecha.getFullYear()}`;
  return `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

export default function AgendaPage() {
  const { usuario, ready } = useRequireAuth();

  const [vista, setVista] = useState<VistaAgenda>("mes");
  const [fechaFoco, setFechaFoco] = useState(() => new Date());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<Evento | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | undefined>();

  const loadEventos = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    setError(null);

    const { from, to } = rangoParaVista(vista, fechaFoco);

    try {
      const data = await apiFetch<Evento[]>(`/agenda/eventos?from=${from.toISOString()}&to=${to.toISOString()}`);
      setEventos(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la agenda");
    } finally {
      setLoading(false);
    }
  }, [usuario, vista, fechaFoco]);

  useEffect(() => {
    loadEventos();
  }, [loadEventos]);

  function abrirCreacion(fecha: Date) {
    setEventoSeleccionado(null);
    setFechaSeleccionada(fecha);
    setDialogOpen(true);
  }

  function abrirEdicion(evento: Evento) {
    setEventoSeleccionado(evento);
    setFechaSeleccionada(undefined);
    setDialogOpen(true);
  }

  function irADia(fecha: Date) {
    setFechaFoco(fecha);
    setVista("dia");
  }

  function irAMes(fecha: Date) {
    setFechaFoco(fecha);
    setVista("mes");
  }

  if (!ready || !usuario) {
    return null;
  }

  if (!tieneAccesoAgenda(usuario)) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">No tienes permisos para ver esta página.</p>
        <Button asChild variant="outline">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="h-full bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Agenda</h1>
            <p className="mt-1 text-sm text-muted-foreground">Cultos, reuniones y actividades de la iglesia.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewSwitcher vista={vista} onChange={setVista} />
            <Button onClick={() => abrirCreacion(fechaFoco)}>
              <Plus className="h-4 w-4" />
              Nuevo evento
            </Button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            aria-label="Período anterior"
            onClick={() => setFechaFoco((f) => avanzar(vista, f, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="w-64 text-center text-sm font-medium capitalize text-foreground">
            {etiquetaPeriodo(vista, fechaFoco)}
          </p>
          <Button
            variant="outline"
            size="icon"
            aria-label="Período siguiente"
            onClick={() => setFechaFoco((f) => avanzar(vista, f, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando agenda...
            </div>
          ) : vista === "dia" ? (
            <DayView dia={fechaFoco} eventos={eventos} onSlotClick={abrirCreacion} onEventoClick={abrirEdicion} />
          ) : vista === "semana" ? (
            <WeekView
              semana={fechaFoco}
              eventos={eventos}
              onSlotClick={abrirCreacion}
              onEventoClick={abrirEdicion}
              onDayNumberClick={irADia}
            />
          ) : vista === "anio" ? (
            <YearView anio={fechaFoco.getFullYear()} eventos={eventos} onMesClick={irAMes} onDiaClick={irADia} />
          ) : (
            <MonthCalendar
              mes={fechaFoco}
              eventos={eventos}
              onDayClick={abrirCreacion}
              onDayNumberClick={irADia}
              onEventoClick={abrirEdicion}
            />
          )}
        </div>
      </div>

      <EventoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultDate={fechaSeleccionada}
        evento={eventoSeleccionado}
        eventosExistentes={eventos}
        onSaved={loadEventos}
        onDeleted={loadEventos}
      />
    </main>
  );
}
