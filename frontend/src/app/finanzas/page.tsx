"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileClock, LineChart, Loader2, Plus, Upload } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DepartamentoSelector } from "@/components/finanzas/departamento-selector";
import { ImportarMovimientosDialog } from "@/components/finanzas/importar-movimientos-dialog";
import { LogsDialog } from "@/components/finanzas/logs-dialog";
import { MovimientoDialog } from "@/components/finanzas/movimiento-dialog";
import { planTieneSubdepartamentos } from "@/components/iglesias/types";
import {
  contextoQueryParam,
  formatoCLP,
  MEDIO_PAGO_LABEL,
  type Categoria,
  type ContextoFinanzas,
  type Departamento,
  type FinanzasDashboard,
  type Movimiento,
} from "@/components/finanzas/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { API_URL, ApiError, apiFetch } from "@/lib/api";

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

// FINANZAS es uno de los 4 módulos delegables (ver frontend/prompt.md): el
// MANAGER siempre tiene acceso; un USUARIO solo si el MANAGER se lo otorgó
// desde /accesos.
function tieneAccesoFinanzas(usuario: { rol: string; modulos: string[] }): boolean {
  return usuario.rol === "MANAGER" || usuario.modulos.includes("FINANZAS");
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "positivo" | "negativo" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={
          tone === "positivo"
            ? "mt-2 text-2xl font-semibold text-emerald-600"
            : tone === "negativo"
              ? "mt-2 text-2xl font-semibold text-amber-600"
              : "mt-2 text-2xl font-semibold text-foreground"
        }
      >
        {formatoCLP.format(value)}
      </p>
    </div>
  );
}

function CategoriaBars({ data, colorClass }: { data: { categoria: string; total: number }[]; colorClass: string }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin movimientos en este período.</p>;
  }

  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.categoria} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm text-foreground">{d.categoria}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${colorClass}`}
              style={{ width: `${Math.max((d.total / max) * 100, 4)}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-sm font-medium text-foreground">
            {formatoCLP.format(d.total)}
          </span>
        </div>
      ))}
    </div>
  );
}

function CargandoFinanzas() {
  return (
    <main className="flex h-full items-center justify-center bg-background p-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando...
      </div>
    </main>
  );
}

function FinanzasContent() {
  const { usuario, ready } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const departamentoIdParam = searchParams.get("departamentoId");

  const contexto: ContextoFinanzas = useMemo(
    () => (departamentoIdParam ? { tipo: "departamento", id: departamentoIdParam } : { tipo: "general" }),
    [departamentoIdParam],
  );

  const [mes, setMes] = useState(() => new Date());
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [dashboard, setDashboard] = useState<FinanzasDashboard | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState<"actual" | "consolidado" | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState<Movimiento | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);

  const rangoMes = useCallback(() => {
    const from = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const to = new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 23, 59, 59);
    return { from, to };
  }, [mes]);

  const loadDatos = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    setError(null);

    const { from, to } = rangoMes();
    const rangoQuery = `from=${from.toISOString()}&to=${to.toISOString()}`;
    const contextoQuery = contextoQueryParam(contexto);
    // El dashboard de "Finanzas general" (sin departamento seleccionado) suma
    // TODA la plata de la iglesia (general + departamentos) y trae el
    // desglose `porDepartamento` — a propósito no manda `general=true`, a
    // diferencia de movimientos/categorías/logs, que sí quedan acotados al
    // libro general (ver frontend/prompt.md sección 1.4).
    const dashboardQuery =
      contexto.tipo === "general" ? rangoQuery : `${rangoQuery}&departamentoId=${contexto.id}`;

    try {
      const [departamentosData, dashboardData, movimientosData, categoriasData] = await Promise.all([
        apiFetch<Departamento[]>("/finanzas/departamentos?incluirInactivos=true"),
        apiFetch<FinanzasDashboard>(`/finanzas/movimientos/dashboard?${dashboardQuery}`),
        apiFetch<Movimiento[]>(`/finanzas/movimientos?${rangoQuery}&${contextoQuery}`),
        apiFetch<Categoria[]>(`/finanzas/categorias?${contextoQuery}`),
      ]);
      setDepartamentos(departamentosData);
      setDashboard(dashboardData);
      setMovimientos(movimientosData);
      setCategorias(categoriasData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la información financiera");
    } finally {
      setLoading(false);
    }
    // `contexto` se resume en su representación de query, no como objeto (cambia de identidad en cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, rangoMes, contexto.tipo, contexto.tipo === "departamento" ? contexto.id : null]);

  useEffect(() => {
    loadDatos();
  }, [loadDatos]);

  const departamentosActivos = departamentos.filter((d) => d.activo);
  const departamentoActual = contexto.tipo === "departamento" ? departamentos.find((d) => d.id === contexto.id) ?? null : null;
  const departamentoNoEncontrado = contexto.tipo === "departamento" && !loading && departamentos.length > 0 && !departamentoActual;

  function abrirCreacion() {
    setMovimientoSeleccionado(null);
    setDialogOpen(true);
  }

  function abrirEdicion(movimiento: Movimiento) {
    setMovimientoSeleccionado(movimiento);
    setDialogOpen(true);
  }

  function agregarCategoria(categoria: Categoria) {
    setCategorias((prev) => [...prev, categoria]);
  }

  async function descargarExportacion(query: string, nombreArchivo: string, tipo: "actual" | "consolidado") {
    setExportando(tipo);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/finanzas/movimientos/exportar?${query}`, { credentials: "include" });
      if (!res.ok) throw new Error();

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo exportar el archivo");
    } finally {
      setExportando(null);
    }
  }

  function exportarActual() {
    const { from, to } = rangoMes();
    const rangoQuery = `from=${from.toISOString()}&to=${to.toISOString()}`;
    const sufijo = mes.getFullYear() + "-" + String(mes.getMonth() + 1).padStart(2, "0");
    const nombreDestino = contexto.tipo === "general" ? "general" : (departamentoActual?.nombre ?? "departamento");
    descargarExportacion(
      `${rangoQuery}&${contextoQueryParam(contexto)}`,
      `movimientos-${nombreDestino}-${sufijo}.xlsx`,
      "actual",
    );
  }

  function exportarConsolidado() {
    const { from, to } = rangoMes();
    const rangoQuery = `from=${from.toISOString()}&to=${to.toISOString()}`;
    const sufijo = mes.getFullYear() + "-" + String(mes.getMonth() + 1).padStart(2, "0");
    descargarExportacion(rangoQuery, `movimientos-consolidado-${sufijo}.xlsx`, "consolidado");
  }

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

  const nombreContextoActual = contexto.tipo === "general" ? "Finanzas general" : (departamentoActual?.nombre ?? "departamento");
  const archivado = Boolean(departamentoActual && !departamentoActual.activo);

  return (
    <main className="h-full bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {contexto.tipo === "general" ? "Finanzas" : `Finanzas — ${nombreContextoActual}`}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {contexto.tipo === "general"
                ? "Ingresos y egresos de la iglesia."
                : `Ingresos y egresos del departamento ${nombreContextoActual}.`}
            </p>
          </div>
          <DepartamentoSelector
            departamentosActivos={departamentosActivos}
            contexto={contexto}
            // Gestión de departamentos requiere plan Pro (ver frontend/prompt.md,
            // sección 9: Básico/Medio no tienen acceso a subdepartamentos) —
            // se oculta el botón en vez de dejar llegar al usuario al 403.
            esManager={usuario.rol === "MANAGER" && Boolean(usuario.iglesia && planTieneSubdepartamentos(usuario.iglesia.plan))}
          />
        </div>

        {archivado && (
          <Alert className="mt-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Este departamento está archivado: se conserva su historial, pero no se pueden agregar movimientos
              nuevos. Puedes reactivarlo desde &ldquo;Gestionar departamentos&rdquo;.
            </AlertDescription>
          </Alert>
        )}

        {departamentoNoEncontrado && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>
              Este departamento ya no existe.{" "}
              <Link href="/finanzas" className="underline">
                Volver a Finanzas general
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={contexto.tipo === "general" ? "/finanzas/analitica" : `/finanzas/analitica?departamentoId=${contexto.id}`}>
              <LineChart className="h-4 w-4" />
              Ver analítica
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setLogsOpen(true)}>
            <FileClock className="h-4 w-4" />
            Logs
          </Button>
          <Button variant="outline" onClick={() => setImportarOpen(true)}>
            <Upload className="h-4 w-4" />
            Importar
          </Button>
          {/* Planes sin subdepartamentos (ver planTieneSubdepartamentos, frontend/prompt.md
              de "Planes comerciales"): el consolidado sería idéntico al general, así que
              el botón no aporta nada en esos planes y solo confunde. */}
          {usuario.iglesia && planTieneSubdepartamentos(usuario.iglesia.plan) && (
            <Button variant="outline" onClick={exportarConsolidado} disabled={exportando !== null}>
              {exportando === "consolidado" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Exportar todo consolidado
            </Button>
          )}
          <Button variant="outline" onClick={exportarActual} disabled={exportando !== null}>
            {exportando === "actual" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar {nombreContextoActual}
          </Button>
          {!archivado && (
            <Button onClick={abrirCreacion}>
              <Plus className="h-4 w-4" />
              Nuevo movimiento
            </Button>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            aria-label="Mes anterior"
            onClick={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="w-48 text-center text-sm font-medium text-foreground">
            {MESES[mes.getMonth()]} {mes.getFullYear()}
          </p>
          <Button
            variant="outline"
            size="icon"
            aria-label="Mes siguiente"
            onClick={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

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
        ) : dashboard ? (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile label="Ingresos" value={dashboard.totales.ingresos} tone="positivo" />
              <StatTile label="Egresos" value={dashboard.totales.egresos} tone="negativo" />
              <StatTile label="Balance" value={dashboard.totales.balance} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-medium text-foreground">Ingresos por categoría</h2>
                <div className="mt-4">
                  <CategoriaBars data={dashboard.porCategoriaIngreso} colorClass="bg-emerald-400" />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-medium text-foreground">Egresos por categoría</h2>
                <div className="mt-4">
                  <CategoriaBars data={dashboard.porCategoriaEgreso} colorClass="bg-amber-400" />
                </div>
              </div>
            </div>

            {/* Solo en "Finanzas general": si se filtró por un departamento puntual, el
                backend igual devuelve `porDepartamento` con un solo elemento (ese
                departamento) cuyos números son idénticos a `totales` — pintarlo ahí
                sería un desglose redundante de un solo renglón (ver frontend/prompt.md). */}
            {contexto.tipo === "general" && dashboard.porDepartamento && dashboard.porDepartamento.length > 0 && (
              <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-medium text-foreground">Desglose por departamento</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aporte de cada departamento al total de arriba (informativo).
                </p>
                <div className="mt-4 space-y-2">
                  {dashboard.porDepartamento.map((d) => (
                    <div
                      key={d.departamentoId}
                      className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm"
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

            <div className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
              <div className="p-6 pb-0">
                <h2 className="text-sm font-medium text-foreground">Movimientos</h2>
              </div>
              {movimientos.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">Sin movimientos en este período.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Medio</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientos.map((m) => (
                      <TableRow key={m.id} className="cursor-pointer" onClick={() => abrirEdicion(m)}>
                        <TableCell className="text-muted-foreground">
                          {new Date(m.fecha).toLocaleDateString("es-CL")}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              m.tipo === "INGRESO"
                                ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                                : "rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700"
                            }
                          >
                            {m.tipo === "INGRESO" ? "Ingreso" : "Egreso"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{MEDIO_PAGO_LABEL[m.medioPago]}</TableCell>
                        <TableCell className="text-foreground">{m.categoria.nombre}</TableCell>
                        <TableCell className="text-muted-foreground">{m.descripcion}</TableCell>
                        <TableCell className="text-right font-medium text-foreground">
                          {formatoCLP.format(Number(m.monto))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        ) : null}
      </div>

      <MovimientoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        movimiento={movimientoSeleccionado}
        categorias={categorias}
        contexto={contexto}
        onCategoriaCreada={agregarCategoria}
        onSaved={loadDatos}
        onDeleted={loadDatos}
      />

      <LogsDialog open={logsOpen} onOpenChange={setLogsOpen} contexto={contexto} />

      <ImportarMovimientosDialog
        open={importarOpen}
        onOpenChange={setImportarOpen}
        departamentosActivos={departamentosActivos}
        contextoInicial={contexto}
        onImportado={loadDatos}
      />
    </main>
  );
}

export default function FinanzasPage() {
  return (
    <Suspense fallback={<CargandoFinanzas />}>
      <FinanzasContent />
    </Suspense>
  );
}
