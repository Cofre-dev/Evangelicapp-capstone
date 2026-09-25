"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { HorizontalBars } from "@/components/dashboard/horizontal-bars";
import { StatTile } from "@/components/dashboard/stat-tile";
import { TrendArea } from "@/components/dashboard/trend-area";
import { VerticalBars } from "@/components/dashboard/vertical-bars";
import { formatHoraUTC, formatMesCorto, formatRangoFechas } from "@/components/dashboard/format";
import type { SuperAdminDashboardResponse } from "@/components/dashboard/types";
import { IglesiaLogo } from "@/components/iglesias/iglesia-logo";
import { PLAN_BADGE_CLASSES, PLAN_LABEL } from "@/components/iglesias/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useRealtimeEvent } from "@/hooks/use-realtime";
import { ApiError, apiFetch } from "@/lib/api";

const CERTIFICADOS_LABEL: Record<keyof SuperAdminDashboardResponse["certificados"]["porTipo"], string> = {
  matrimonios: "Matrimonios",
  bautizos: "Bautizos",
  defunciones: "Defunciones",
  presentaciones: "Presentaciones",
};

export default function SuperAdminDashboardPage() {
  const { usuario, ready } = useRequireAuth();

  const [data, setData] = useState<SuperAdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!usuario) return;
    setError(null);

    try {
      const response = await apiFetch<SuperAdminDashboardResponse>("/superadmin/dashboard");
      setData(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Realtime (ver frontend/prompt.md): parcha la fila en "Iglesias recientes"
  // sin refetch. No agrega filas nuevas — esa lista es "recién creadas", no
  // "recién actualizadas", y el propio evento nunca se dispara para un alta
  // (`iglesia:actualizada` solo cubre las 4 acciones de facturación/estado
  // sobre una iglesia ya existente).
  useRealtimeEvent("iglesia:actualizada", (iglesia) => {
    setData((prev) => {
      if (!prev || !prev.iglesiasRecientes.some((i) => i.id === iglesia.id)) return prev;
      return {
        ...prev,
        iglesiasRecientes: prev.iglesiasRecientes.map((i) => (i.id === iglesia.id ? iglesia : i)),
      };
    });
  });

  if (!ready || !usuario) {
    return null;
  }

  if (usuario.rol !== "SUPER_ADMIN") {
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
    <main className="h-full bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Panel de control</h1>
          <p className="mt-1 text-sm text-muted-foreground">El pulso de la red de iglesias en la plataforma.</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando dashboard…
          </div>
        ) : data ? (
          <>
            {/* Hero: pulso de actividad — abre con "¿está viva la red ahora?",
                el trabajo real de esta pantalla, en vez de una fila de KPIs
                genérica. Único lugar de la app junto con la tira de "tiempo de
                uso" del home de Manager/Usuario que usa --chart-accent. */}
            <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Usuarios activos hoy</p>
                  <p className="mt-1 font-display text-5xl tabular-nums text-foreground">
                    {data.totales.usuariosActivosHoy.toLocaleString("es-CL")}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {data.totales.usuariosActivosSemana.toLocaleString("es-CL")} en la última semana
                  </p>
                </div>
                <div className="w-full sm:max-w-md">
                  <TrendArea
                    data={data.actividad.porDia.map((p) => ({ fecha: p.fecha, value: p.sesiones }))}
                    ariaLabel="Sesiones por día, últimos 30 días"
                    caption={
                      data.actividad.porDia.length > 0
                        ? `${formatRangoFechas(data.actividad.porDia[0].fecha, data.actividad.porDia[data.actividad.porDia.length - 1].fecha)} · sesiones por día`
                        : undefined
                    }
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Iglesias activas" value={data.totales.iglesiasActivas.toLocaleString("es-CL")} />
              <StatTile
                label="Iglesias suspendidas"
                value={data.totales.iglesiasSuspendidas.toLocaleString("es-CL")}
                tone={data.totales.iglesiasSuspendidas > 0 ? "negative" : "default"}
              />
              <StatTile label="Pastores" value={data.totales.pastores.toLocaleString("es-CL")} />
              <StatTile
                label="Certificados emitidos"
                value={data.totales.certificadosEmitidos.toLocaleString("es-CL")}
                helpText="Matrimonios, bautizos, defunciones y presentaciones"
              />
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-medium text-foreground">Horas de mayor actividad</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Sesiones por hora (hora UTC).</p>
              <div className="mt-4">
                <VerticalBars
                  data={data.actividad.porHora.map((p) => ({ label: formatHoraUTC(p.hora), value: p.sesiones }))}
                  colorClass="bg-chart-accent"
                  labelEvery={3}
                  ariaLabel="Sesiones por hora del día, en hora UTC"
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-medium text-foreground">Certificados por tipo</h2>
                <div className="mt-4">
                  <HorizontalBars
                    data={(Object.keys(CERTIFICADOS_LABEL) as (keyof typeof CERTIFICADOS_LABEL)[]).map((tipo) => ({
                      label: CERTIFICADOS_LABEL[tipo],
                      value: data.certificados.porTipo[tipo],
                    }))}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-medium text-foreground">Certificados por mes</h2>
                <div className="mt-4">
                  <VerticalBars
                    data={data.certificados.porMes.map((p) => ({ label: formatMesCorto(p.mes), value: p.cantidad }))}
                    ariaLabel="Certificados emitidos por mes, últimos 6 meses"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-medium text-foreground">Iglesias por región</h2>
                <div className="mt-4">
                  <HorizontalBars
                    data={data.porRegion.map((r) => ({ label: r.region, value: r.cantidad }))}
                    emptyMessage="Todavía no hay iglesias registradas."
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-medium text-foreground">Iglesias por plan</h2>
                <div className="mt-4">
                  <HorizontalBars data={data.porPlan.map((p) => ({ label: PLAN_LABEL[p.plan], value: p.cantidad }))} />
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-4 p-6 pb-4">
                <h2 className="text-sm font-medium text-foreground">Iglesias recientes</h2>
                <Link
                  href="/superadmin/iglesias"
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Ver todas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              {data.iglesiasRecientes.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">Aún no hay iglesias creadas.</p>
              ) : (
                <div className="divide-y divide-border border-t border-border">
                  {data.iglesiasRecientes.map((iglesia) => (
                    <Link
                      key={iglesia.id}
                      href={`/superadmin/iglesias/${iglesia.id}`}
                      className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-accent/40"
                    >
                      <IglesiaLogo logoUrl={iglesia.logoUrl} nombre={iglesia.nombre} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{iglesia.nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {iglesia.comuna}, {iglesia.region}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_BADGE_CLASSES[iglesia.plan]}`}
                      >
                        {PLAN_LABEL[iglesia.plan]}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
