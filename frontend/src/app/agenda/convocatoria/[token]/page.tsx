"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Building2, Loader2, MapPin } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ESTADO_ASISTENCIA_CLASS,
  ESTADO_ASISTENCIA_LABEL,
  ESTADO_PREDICADOR_CLASS,
  ESTADO_PREDICADOR_LABEL,
  type EstadoAsistencia,
  type EstadoConfirmacionPredicador,
} from "@/components/agenda/types";
import {
  useConvocatoriaRealtime,
  type AsistenciaRespondidaBroadcast,
  type PredicadorRespondioBroadcast,
} from "@/hooks/use-convocatoria-realtime";
import { ApiError, apiFetch } from "@/lib/api";

interface PredicadorPublico {
  id: string;
  nombre: string | null;
  estado: EstadoConfirmacionPredicador;
  respondidoAt: string | null;
}

interface AsistenciaPublica {
  integranteId: string;
  nombreCompleto: string;
  estado: EstadoAsistencia;
  respondidoAt: string | null;
}

interface ConvocatoriaPublica {
  evento: {
    titulo: string;
    descripcion: string | null;
    fechaInicio: string;
    fechaFin: string;
    ubicacion: string | null;
    iglesia: { nombre: string; logoUrl: string | null };
  };
  predicadores: PredicadorPublico[];
  asistencias: AsistenciaPublica[];
}

const GRUPOS: { estado: EstadoAsistencia; titulo: string }[] = [
  { estado: "CONFIRMADO", titulo: "Confirmaron" },
  { estado: "PENDIENTE", titulo: "Sin responder" },
  { estado: "RECHAZADO", titulo: "Rechazaron" },
];

function Fila({ nombre, badgeClass, badgeLabel }: { nombre: string; badgeClass: string; badgeLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
      <span className="min-w-0 truncate font-medium text-foreground">{nombre}</span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>{badgeLabel}</span>
    </div>
  );
}

export default function ConvocatoriaPublicaPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? null;

  const [data, setData] = useState<ConvocatoriaPublica | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<ConvocatoriaPublica>(`/agenda/convocatoria/${token}/estado`)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Este enlace no es válido o el evento ya no está disponible.");
        } else {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar el estado de la convocatoria.");
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const onPredicadorRespondio = useCallback((payload: PredicadorRespondioBroadcast) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            predicadores: prev.predicadores.map((p) =>
              p.id === payload.predicadorId ? { ...p, estado: payload.estado, respondidoAt: payload.respondidoAt } : p,
            ),
          }
        : prev,
    );
  }, []);

  const onAsistenciaRespondida = useCallback((payload: AsistenciaRespondidaBroadcast) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            asistencias: prev.asistencias.map((a) =>
              a.integranteId === payload.integranteId
                ? { ...a, estado: payload.estado, respondidoAt: payload.respondidoAt }
                : a,
            ),
          }
        : prev,
    );
  }, []);

  const { sinRealtime } = useConvocatoriaRealtime(data ? token : null, {
    onPredicadorRespondio,
    onAsistenciaRespondida,
  });

  return (
    <main className="flex min-h-screen justify-center bg-background p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando…
          </div>
        ) : error || !data ? (
          <Alert variant="destructive">
            <AlertDescription>{error ?? "No se pudo cargar el estado de la convocatoria."}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2 text-center">
              {data.evento.iglesia.logoUrl ? (
                <Image
                  src={data.evento.iglesia.logoUrl}
                  alt={`Logo de ${data.evento.iglesia.nombre}`}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full border border-border object-contain"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
              )}
              <p className="text-sm font-medium text-foreground">{data.evento.iglesia.nombre}</p>
            </div>

            <div className="mt-6 border-t border-border pt-6 text-center">
              <p className="text-sm text-muted-foreground">Estado de la convocatoria</p>
              <h1 className="mt-1 text-lg font-semibold text-foreground">{data.evento.titulo}</h1>
              {data.evento.descripcion && <p className="mt-2 text-sm text-muted-foreground">{data.evento.descripcion}</p>}
              <p className="mt-2 text-sm text-muted-foreground">
                {new Date(data.evento.fechaInicio).toLocaleDateString("es-CL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(data.evento.fechaInicio).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                {" – "}
                {new Date(data.evento.fechaFin).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
              </p>
              {data.evento.ubicacion && (
                <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {data.evento.ubicacion}
                </p>
              )}
            </div>

            <div className="mt-6 space-y-6">
              {data.predicadores.length > 0 && (
                <section className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Predicadores invitados</p>
                  {(["CONFIRMADO", "PENDIENTE", "RECHAZADO"] as EstadoConfirmacionPredicador[]).map((estado) => {
                    const items = data.predicadores.filter((p) => p.estado === estado);
                    if (items.length === 0) return null;
                    return (
                      <div key={estado} className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {ESTADO_PREDICADOR_LABEL[estado]} ({items.length})
                        </p>
                        {items.map((p) => (
                          <Fila
                            key={p.id}
                            nombre={p.nombre || "Predicador invitado"}
                            badgeClass={ESTADO_PREDICADOR_CLASS[p.estado]}
                            badgeLabel={ESTADO_PREDICADOR_LABEL[p.estado]}
                          />
                        ))}
                      </div>
                    );
                  })}
                </section>
              )}

              {data.asistencias.length > 0 && (
                <section className="space-y-4">
                  <p className="text-sm font-medium text-foreground">Convocatoria a la congregación</p>
                  {GRUPOS.map(({ estado, titulo }) => {
                    const items = data.asistencias.filter((a) => a.estado === estado);
                    return (
                      <div key={estado} className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {titulo} ({items.length})
                        </p>
                        {items.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nadie en este grupo.</p>
                        ) : (
                          items.map((a) => (
                            <Fila
                              key={a.integranteId}
                              nombre={a.nombreCompleto}
                              badgeClass={ESTADO_ASISTENCIA_CLASS[a.estado]}
                              badgeLabel={ESTADO_ASISTENCIA_LABEL[a.estado]}
                            />
                          ))
                        )}
                      </div>
                    );
                  })}
                </section>
              )}

              {data.predicadores.length === 0 && data.asistencias.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Todavía no hay invitados para este evento.
                </p>
              )}
            </div>

            {sinRealtime && (
              <p className="mt-6 text-center text-xs text-muted-foreground">
                Actualiza la página para ver los últimos cambios.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
