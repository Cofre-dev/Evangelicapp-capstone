"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BalanceMensualChart, type PuntoIngresosEgresos } from "@/components/finanzas/balance-mensual-chart";
import { DepartamentoSelector } from "@/components/finanzas/departamento-selector";
import { HorizontalBars } from "@/components/dashboard/horizontal-bars";
import { StatTile } from "@/components/dashboard/stat-tile";
import { planTieneSubdepartamentos } from "@/components/iglesias/types";
import {
  formatoCLP,
  type ContextoFinanzas,
  type Departamento,
  type FinanzasDashboard,
  type FinanzasDashboardPorDepartamento,
} from "@/components/finanzas/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { ApiError, apiFetch } from "@/lib/api";

const MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Mismo criterio que /finanzas (ver frontend/prompt.md): MANAGER siempre
// tiene acceso, un USUARIO solo si el MANAGER se lo otorgó desde /accesos.
function tieneAccesoFinanzas(usuario: { rol: string; modulos: string[] }): boolean {
  return usuario.rol === "MANAGER" || usuario.modulos.includes("FINANZAS");
}

function acumularCategorias(
  resultados: FinanzasDashboard[],
  campo: "porCategoriaIngreso" | "porCategoriaEgreso",
): { categoria: string; total: number }[] {
  const mapa = new Map<string, number>();
  for (const r of resultados) {
    for (const c of r[campo]) {
      mapa.set(c.categoria, (mapa.get(c.categoria) ?? 0) + c.total);
    }
  }
  return Array.from(mapa.entries())
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

function acumularDepartamentos(resultados: FinanzasDashboard[]): FinanzasDashboardPorDepartamento[] {
  const mapa = new Map<string, FinanzasDashboardPorDepartamento>();
  for (const r of resultados) {
    for (const d of r.porDepartamento ?? []) {
      const actual = mapa.get(d.departamentoId) ?? { departamentoId: d.departamentoId, nombre: d.nombre, ingresos: 0, egresos: 0, balance: 0 };
      mapa.set(d.departamentoId, {
        departamentoId: d.departamentoId,
        nombre: d.nombre,
        ingresos: actual.ingresos + d.ingresos,
        egresos: actual.egresos + d.egresos,
        balance: actual.balance + d.balance,
      });
    }
  }
  return Array.from(mapa.values()).sort((a, b) => b.balance - a.balance);
}

function CargandoAnalitica() {
  return (
    <main className="flex h-full items-center justify-center bg-background p-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando...
      </div>
    </main>
  );
}

function AnaliticaContent() {
  const { usuario, ready } = useRequireAuth();
  const searchParams = useSearchParams();
  const departamentoIdParam = searchParams.get("departamentoId");

  const contexto: ContextoFinanzas = useMemo(
    () => (departamentoIdParam ? { tipo: "departamento", id: departamentoIdParam } : { tipo: "general" }),
    [departamentoIdParam],
  );

  const anio = new Date().getFullYear();

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [resultadosMensuales, setResultadosMensuales] = useState<FinanzasDashboard[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDatos = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    setError(null);

    try {
      const fetchesMensuales = Array.from({ length: 12 }, (_, mesIdx) => {
        const from = new Date(anio, mesIdx, 1);
        const to = new Date(anio, mesIdx + 1, 0, 23, 59, 59);
        const rangoQuery = `from=${from.toISOString()}&to=${to.toISOString()}`;
        // Mismo criterio que /finanzas: "general" no manda `general=true` a
        // propósito, para que el backend sume iglesia + departamentos y
        // devuelva el desglose `porDepartamento` (ver frontend/prompt.md).
        const dashboardQuery = contexto.tipo === "general" ? rangoQuery : `${rangoQuery}&departamentoId=${contexto.id}`;
        return apiFetch<FinanzasDashboard>(`/finanzas/movimientos/dashboard?${dashboardQuery}`);
      });

      const [departamentosData, ...meses] = await Promise.all([
        apiFetch<Departamento[]>("/finanzas/departamentos?incluirInactivos=true"),
        ...fetchesMensuales,
      ]);
      setDepartamentos(departamentosData);
      setResultadosMensuales(meses);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la analítica financiera");
    } finally {
      setLoading(false);
    }
    // `contexto` se resume en su representación relevante (tipo/id), no como objeto (cambia de identidad en cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, anio, contexto.tipo, contexto.tipo === "departamento" ? contexto.id : null]);

  useEffect(() => {
    loadDatos();
  }, [loadDatos]);

  if (!ready || !usuario) {
    return null;
  }

  if (!tieneAccesoFinanzas(usuario)) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">No tienes permisos para ver esta página.</p>
        <Button asChild variant="outline">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </main>
    );
  }

  const departamentosActivos = departamentos.filter((d) => d.activo);
  const departamentoActual = contexto.tipo === "departamento" ? departamentos.find((d) => d.id === contexto.id) ?? null : null;
  const departamentoNoEncontrado = contexto.tipo === "departamento" && !loading && departamentos.length > 0 && !departamentoActual;
  const nombreContextoActual = contexto.tipo === "general" ? "Finanzas general" : (departamentoActual?.nombre ?? "departamento");
  const volverHref = contexto.tipo === "general" ? "/finanzas" : `/finanzas?departamentoId=${contexto.id}`;

  const balancePorMes: PuntoIngresosEgresos[] =
    resultadosMensuales?.map((d, i) => ({ mes: MESES_CORTO[i], ingresos: d.totales.ingresos, egresos: d.totales.egresos })) ?? [];

  const totalesAnio = (resultadosMensuales ?? []).reduce(
    (acc, d) => ({
      ingresos: acc.ingresos + d.totales.ingresos,
      egresos: acc.egresos + d.totales.egresos,
      balance: acc.balance + d.totales.balance,
    }),
    { ingresos: 0, egresos: 0, balance: 0 },
  );

  const topIngresos = resultadosMensuales ? acumularCategorias(resultadosMensuales, "porCategoriaIngreso") : [];
  const topEgresos = resultadosMensuales ? acumularCategorias(resultadosMensuales, "porCategoriaEgreso") : [];
  const porDepartamento = resultadosMensuales && contexto.tipo === "general" ? acumularDepartamentos(resultadosMensuales) : [];

  return (
    <main className="h-full bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {contexto.tipo === "general" ? "Analítica" : `Analítica — ${nombreContextoActual}`}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Resumen del {anio}, mes a mes.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DepartamentoSelector
              departamentosActivos={departamentosActivos}
              contexto={contexto}
              esManager={usuario.rol === "MANAGER" && Boolean(usuario.iglesia && planTieneSubdepartamentos(usuario.iglesia.plan))}
              basePath="/finanzas/analitica"
            />
            <Button variant="outline" asChild>
              <Link href={volverHref}>
                <ArrowLeft className="h-4 w-4" />
                Volver a movimientos
              </Link>
            </Button>
          </div>
        </div>

        {departamentoNoEncontrado && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>
              Este departamento ya no existe.{" "}
              <Link href="/finanzas/analitica" className="underline">
                Volver a Finanzas general
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : resultadosMensuales ? (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile label={`Ingresos ${anio}`} value={formatoCLP.format(totalesAnio.ingresos)} tone="positive" />
              <StatTile label={`Egresos ${anio}`} value={formatoCLP.format(totalesAnio.egresos)} tone="negative" />
              <StatTile label={`Balance ${anio}`} value={formatoCLP.format(totalesAnio.balance)} />
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-medium text-foreground">Ingresos y egresos mensuales</h2>
              <div className="mt-4">
                <BalanceMensualChart data={balancePorMes} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-medium text-foreground">Top categorías de ingreso</h2>
                <div className="mt-4">
                  <HorizontalBars
                    data={topIngresos.map((c) => ({ label: c.categoria, value: c.total }))}
                    colorClass="bg-emerald-400"
                    valueFormatter={(v) => formatoCLP.format(v)}
                    valueWidthClass="w-28"
                    emptyMessage="Sin movimientos este año."
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-medium text-foreground">Top categorías de egreso</h2>
                <div className="mt-4">
                  <HorizontalBars
                    data={topEgresos.map((c) => ({ label: c.categoria, value: c.total }))}
                    colorClass="bg-amber-400"
                    valueFormatter={(v) => formatoCLP.format(v)}
                    valueWidthClass="w-28"
                    emptyMessage="Sin movimientos este año."
                  />
                </div>
              </div>
            </div>

            {contexto.tipo === "general" && porDepartamento.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-medium text-foreground">Desglose por departamento</h2>
                <p className="mt-1 text-xs text-muted-foreground">Aporte de cada departamento al total del {anio}.</p>
                <div className="mt-4 space-y-2">
                  {porDepartamento.map((d) => (
                    <div
                      key={d.departamentoId}
                      className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm"
                    >
                      <span className="font-medium text-foreground">{d.nombre}</span>
                      <div className="flex gap-4 text-right">
                        <span className="text-emerald-600">{formatoCLP.format(d.ingresos)}</span>
                        <span className="text-amber-600">{formatoCLP.format(d.egresos)}</span>
                        <span className="font-medium text-foreground">{formatoCLP.format(d.balance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function AnaliticaFinanzasPage() {
  return (
    <Suspense fallback={<CargandoAnalitica />}>
      <AnaliticaContent />
    </Suspense>
  );
}