"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Bell, Building2 } from "lucide-react";

import { ProximosEventos } from "@/components/agenda/proximos-eventos";
import type { Evento } from "@/components/agenda/types";
import { StatTile } from "@/components/dashboard/stat-tile";
import { VersiculoDelDia } from "@/components/dashboard/versiculo-del-dia";
import type { ManagerDashboardResponse } from "@/components/dashboard/types";
import { MisTareasModal } from "@/components/notas/mis-tareas-modal";
import type { Nota } from "@/components/notas/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch } from "@/lib/api";
import { type Rol, type SessionUser } from "@/stores/auth-store";

/** Ver frontend/prompt.md: cualquier USUARIO (tenga o no módulos otorgados)
 * puede ver/marcar sus propias tareas asignadas — no depende de `modulos`. */
function tieneAccesoTareas(usuario: SessionUser): boolean {
  return usuario.rol === "MANAGER" || usuario.rol === "USUARIO";
}

/** AGENDA es uno de los 4 módulos delegables (ver frontend/prompt.md). */
function tieneAccesoAgenda(usuario: SessionUser): boolean {
  return usuario.rol === "MANAGER" || usuario.modulos.includes("AGENDA");
}

/** Landing con KPIs (`GET /dashboard`) — solo MANAGER/USUARIO (ver
 * frontend/prompt.md sección 6): SUPER_ADMIN tiene el suyo propio en
 * `/superadmin`, MIEMBRO todavía no tiene funcionalidad propia en la app. */
function tieneLandingPersonal(usuario: SessionUser): boolean {
  return usuario.rol === "MANAGER" || usuario.rol === "USUARIO";
}

const ROL_LABEL: Record<Rol, string> = {
  MANAGER: "Manager",
  USUARIO: "Usuario",
  SUPER_ADMIN: "Administrador",
  MIEMBRO: "Miembro",
};

function saludoSegunHora(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

export default function Home() {
  const { usuario, ready } = useRequireAuth();

  const [tareas, setTareas] = useState<Nota[]>([]);
  const [modalTareasOpen, setModalTareasOpen] = useState(false);
  const [eventosProximos, setEventosProximos] = useState<Evento[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(true);
  const [dashboardData, setDashboardData] = useState<ManagerDashboardResponse | null>(null);

  const cargarTareas = useCallback(async () => {
    if (!usuario || !tieneAccesoTareas(usuario)) return;
    try {
      const data = await apiFetch<Nota[]>("/notas/mis-tareas");
      setTareas(data);
    } catch {
      // Si falla, simplemente no se muestra el aviso — no es una acción crítica del usuario.
    }
  }, [usuario]);

  const cargarEventosProximos = useCallback(async () => {
    if (!usuario || !tieneAccesoAgenda(usuario)) {
      setLoadingEventos(false);
      return;
    }
    setLoadingEventos(true);
    try {
      const ahora = new Date();
      const en30Dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);
      const data = await apiFetch<Evento[]>(
        `/agenda/eventos?from=${ahora.toISOString()}&to=${en30Dias.toISOString()}`,
      );
      const proximos = data
        .filter((e) => new Date(e.fechaFin) >= ahora)
        .sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime())
        .slice(0, 5);
      setEventosProximos(proximos);
    } catch {
      // Igual que las tareas: no es crítico, la sección simplemente queda vacía.
    } finally {
      setLoadingEventos(false);
    }
  }, [usuario]);

  const cargarDashboard = useCallback(async () => {
    if (!usuario || !tieneLandingPersonal(usuario)) return;
    try {
      const data = await apiFetch<ManagerDashboardResponse>("/dashboard");
      setDashboardData(data);
    } catch {
      // Igual que tareas/eventos: no crítico, la landing se ve completa igual sin estos datos.
    }
  }, [usuario]);

  useEffect(() => {
    cargarTareas();
  }, [cargarTareas]);

  useEffect(() => {
    cargarEventosProximos();
  }, [cargarEventosProximos]);

  useEffect(() => {
    cargarDashboard();
  }, [cargarDashboard]);

  function onTareaActualizada(tarea: Nota) {
    setTareas((prev) => (tarea.estado === "EN_REVISION" ? prev.map((t) => (t.id === tarea.id ? tarea : t)) : prev.filter((t) => t.id !== tarea.id)));
  }

  if (!ready || !usuario) {
    return null;
  }

  const fechaHoy = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="min-h-full bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Hero: refuerza que la iglesia del pastor tiene un lugar propio y activo en la app. */}
        <div className="relative overflow-hidden rounded-3x1 border border-border bg-[linear-gradient(135deg,hsl(var(--primary)/0.16),hsl(var(--accent)/0.55)_55%,hsl(var(--background)))] p-8 shadow-sm sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[hsl(var(--primary)/0.18)] blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-[hsl(var(--accent)/0.5)] blur-3xl"
          />

          <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div>
              <p className="font-display text-3xl italic text-primary sm:text-4xl">
                {saludoSegunHora()}, {usuario.nombre}
              </p>
              <p className="mt-1 text-sm uppercase tracking-wide text-muted-foreground">{ROL_LABEL[usuario.rol]}</p>
              <p className="mt-4 text-sm capitalize text-muted-foreground">{fechaHoy}</p>
            </div>

            {usuario.iglesia && (
              <div className="flex flex-col items-center gap-3 sm:items-end">
                {usuario.iglesia.logoUrl ? (
                  <Image
                    src={usuario.iglesia.logoUrl}
                    alt={`Logo de ${usuario.iglesia.nombre}`}
                    width={100}
                    height={100}
                    className="h-20 w-20 rounded-full border-4 border-card object-contain shadow-md sm:h-22 sm:w-22"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-card bg-primary/15 text-primary shadow-md">
                    <Building2 className="h-9 w-9" />
                  </div>
                )}
                <p className="text-lg font-semibold text-foreground">{usuario.iglesia.nombre}</p>
                {/* <p className="text-xs font-medium text-primary">Tu iglesia está aquí, activa y presente</p> */}
              </div>
            )}
          </div>
        </div>

        {tieneLandingPersonal(usuario) &&
          dashboardData &&
          (dashboardData.integrantes || dashboardData.agenda || dashboardData.ceremonias || dashboardData.equipo) && (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {dashboardData.integrantes && (
                <StatTile
                  label="Integrantes"
                  value={dashboardData.integrantes.total.toLocaleString("es-CL")}
                  helpText={`+${dashboardData.integrantes.nuevosUltimoMes} este mes`}
                />
              )}
              {dashboardData.agenda && (
                <StatTile label="Próximos eventos" value={dashboardData.agenda.proximosEventos.toLocaleString("es-CL")} />
              )}
              {dashboardData.ceremonias && (
                <StatTile
                  label="Certificados emitidos"
                  value={dashboardData.ceremonias.total.toLocaleString("es-CL")}
                  helpText="Matrimonios, bautizos, defunciones y presentaciones"
                />
              )}
              {dashboardData.equipo && (
                <StatTile label="Equipo activo hoy" value={dashboardData.equipo.usuariosActivosHoy.toLocaleString("es-CL")} />
              )}
            </div>
          )}

        {tieneLandingPersonal(usuario) && <VersiculoDelDia />}

        {tareas.length > 0 && (
          <button
            type="button"
            onClick={() => setModalTareasOpen(true)}
            className="mt-6 flex w-full items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left shadow-sm transition-colors hover:bg-amber-100"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Bell className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-amber-900">
                Tienes {tareas.length} {tareas.length === 1 ? "tarea" : "tareas"} pendiente{tareas.length === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-amber-700">Toca aquí para verlas</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-amber-700" />
          </button>
        )}

        {tieneAccesoAgenda(usuario) && <ProximosEventos eventos={eventosProximos} loading={loadingEventos} />}
      </div>

      <MisTareasModal
        open={modalTareasOpen}
        onOpenChange={setModalTareasOpen}
        tareas={tareas}
        onTareaActualizada={onTareaActualizada}
      />
    </main>
  );
}
