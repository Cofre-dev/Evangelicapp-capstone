"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateIglesiaDialog } from "@/components/iglesias/create-iglesia-dialog";
import { IglesiaLogo } from "@/components/iglesias/iglesia-logo";
import {
  FACTURACION_BAR_CLASSES,
  PLAN_BADGE_CLASSES,
  PLAN_LABEL,
  type IglesiaListItem,
} from "@/components/iglesias/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useRealtimeEvent } from "@/hooks/use-realtime";
import { ApiError, apiFetch } from "@/lib/api";
import { REGIONES_CHILE } from "@/lib/chile-regiones";

const ESTADOS = ["ACTIVA", "SUSPENDIDA", "INACTIVA"] as const;
const PLANES = ["BASICO", "MEDIO", "PRO"] as const;

const ESTADO_LABEL: Record<(typeof ESTADOS)[number], string> = {
  ACTIVA: "Activa",
  SUSPENDIDA: "Suspendida",
  INACTIVA: "Inactiva",
};

const ESTADO_BADGE_CLASSES: Record<(typeof ESTADOS)[number], string> = {
  ACTIVA: "bg-accent text-primary",
  SUSPENDIDA: "bg-muted text-muted-foreground",
  INACTIVA: "bg-muted text-muted-foreground",
};

// Radix Select no permite value="" — usamos un sentinel para el ítem "Todos"
// y lo traducimos a "sin filtro" (query param ausente) al leer/escribir la URL.
const TODOS = "__todos__";

function CargandoIglesias() {
  return (
    <main className="flex h-full items-center justify-center bg-background p-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando…
      </div>
    </main>
  );
}

function IglesiasContent() {
  const { usuario, ready } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchParam = searchParams.get("search") ?? "";
  const estadoParam = searchParams.get("estado") ?? "";
  const planParam = searchParams.get("plan") ?? "";
  const regionParam = searchParams.get("region") ?? "";

  // Input local para no disparar un fetch (y una escritura de URL) en cada
  // tecla — se sincroniza a la URL con debounce más abajo.
  const [searchInput, setSearchInput] = useState(searchParam);
  const [data, setData] = useState<IglesiaListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const actualizarQuery = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.replace(`/superadmin/iglesias${params.toString() ? `?${params.toString()}` : ""}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== searchParam) actualizarQuery({ search: searchInput });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (searchParam) params.set("search", searchParam);
    if (estadoParam) params.set("estado", estadoParam);
    if (planParam) params.set("plan", planParam);
    if (regionParam) params.set("region", regionParam);

    try {
      const response = await apiFetch<IglesiaListItem[]>(`/iglesias?${params.toString()}`);
      setData(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el listado de iglesias");
    } finally {
      setLoading(false);
    }
  }, [usuario, searchParam, estadoParam, planParam, regionParam]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Realtime (ver frontend/prompt.md): parcha la fila en vez de refetchear el
  // listado completo. Solo actualiza filas ya cargadas — no inserta iglesias
  // nuevas que hayan empezado a matchear los filtros activos recién con este
  // cambio, porque no hay forma de saber eso sin volver a pedir la lista.
  useRealtimeEvent("iglesia:actualizada", (iglesia) => {
    setData((prev) => {
      if (!prev || !prev.some((i) => i.id === iglesia.id)) return prev;
      return prev.map((i) => (i.id === iglesia.id ? iglesia : i));
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

  const hayFiltrosActivos = Boolean(searchParam || estadoParam || planParam || regionParam);

  return (
    <main className="h-full bg-background p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Iglesias</h1>
            <p className="mt-1 text-sm text-muted-foreground">Todas las iglesias registradas en la plataforma.</p>
          </div>
          <CreateIglesiaDialog onCreated={() => cargar()} />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[220px] flex-1 space-y-2">
            <Label htmlFor="buscar-iglesia">Buscar</Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="buscar-iglesia"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Nombre de la iglesia…"
                autoComplete="off"
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-full space-y-2 sm:w-40">
            <Label htmlFor="filtro-estado">Estado</Label>
            <Select
              value={estadoParam || TODOS}
              onValueChange={(value) => actualizarQuery({ estado: value === TODOS ? "" : value })}
            >
              <SelectTrigger id="filtro-estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {ESTADOS.map((estado) => (
                  <SelectItem key={estado} value={estado}>
                    {ESTADO_LABEL[estado]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full space-y-2 sm:w-40">
            <Label htmlFor="filtro-plan">Plan</Label>
            <Select
              value={planParam || TODOS}
              onValueChange={(value) => actualizarQuery({ plan: value === TODOS ? "" : value })}
            >
              <SelectTrigger id="filtro-plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {PLANES.map((plan) => (
                  <SelectItem key={plan} value={plan}>
                    {PLAN_LABEL[plan]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full space-y-2 sm:w-52">
            <Label htmlFor="filtro-region">Región</Label>
            <Select
              value={regionParam || TODOS}
              onValueChange={(value) => actualizarQuery({ region: value === TODOS ? "" : value })}
            >
              <SelectTrigger id="filtro-region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {REGIONES_CHILE.map((r) => (
                  <SelectItem key={r.region} value={r.region}>
                    {r.region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : data && data.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {hayFiltrosActivos ? "Ninguna iglesia coincide con estos filtros." : "Aún no hay iglesias creadas."}
            </p>
          </div>
        ) : data ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="divide-y divide-border">
              {data.map((iglesia) => (
                <Link
                  key={iglesia.id}
                  href={`/superadmin/iglesias/${iglesia.id}`}
                  className={`flex items-center gap-4 border-l-4 px-6 py-4 transition-colors hover:bg-accent/40 ${FACTURACION_BAR_CLASSES[iglesia.facturacion.color]}`}
                >
                  <IglesiaLogo logoUrl={iglesia.logoUrl} nombre={iglesia.nombre} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{iglesia.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {iglesia.comuna}, {iglesia.region}
                    </p>
                  </div>
                  <div className="hidden min-w-0 flex-1 sm:block">
                    <p className="truncate text-sm text-foreground">
                      {iglesia.pastor ? `${iglesia.pastor.nombre} ${iglesia.pastor.apellido}` : "Sin pastor asignado"}
                    </p>
                    {iglesia.pastor && <p className="truncate text-xs text-muted-foreground">{iglesia.pastor.email}</p>}
                  </div>
                  <span
                    className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium sm:inline-block ${PLAN_BADGE_CLASSES[iglesia.plan]}`}
                  >
                    {PLAN_LABEL[iglesia.plan]}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_BADGE_CLASSES[iglesia.estado]}`}
                  >
                    {ESTADO_LABEL[iglesia.estado]}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function IglesiasPage() {
  return (
    <Suspense fallback={<CargandoIglesias />}>
      <IglesiasContent />
    </Suspense>
  );
}
