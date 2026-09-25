"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { Building2, Calendar, Check, Loader2, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AsistenciaEvento } from "@/components/agenda/types";
import { ApiError, apiFetch } from "@/lib/api";

function CargandoInvitacion() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando invitación...
        </div>
      </div>
    </main>
  );
}

function AsistenciaEventoContent() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  // El link del correo trae la respuesta pre-seleccionada, pero nunca dispara
  // el POST solo por visitar la página — solo resalta visualmente el botón
  // correspondiente; el usuario igual tiene que hacer click para confirmar.
  const respuestaSugerida = searchParams.get("respuesta");

  const [data, setData] = useState<AsistenciaEvento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);

  const mensajeError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      return err.status === 404 ? "Este link no es válido o ya no está disponible." : err.message;
    }
    return fallback;
  }, []);

  const cargar = useCallback(async () => {
    if (!params.token) return;
    try {
      const actualizado = await apiFetch<AsistenciaEvento>(`/agenda/asistencias/${params.token}`);
      setData(actualizado);
      setError(null);
    } catch (err) {
      setError(mensajeError(err, "No se pudo cargar la invitación"));
    }
  }, [params.token, mensajeError]);

  useEffect(() => {
    if (!params.token) return;
    setLoading(true);
    cargar().finally(() => setLoading(false));
  }, [params.token, cargar]);

  async function responder(respuesta: "CONFIRMADO" | "RECHAZADO") {
    if (!params.token) return;
    setResponding(true);
    setError(null);

    try {
      const actualizado = await apiFetch<AsistenciaEvento>(`/agenda/asistencias/${params.token}/responder`, {
        method: "POST",
        body: JSON.stringify({ respuesta }),
      });
      setData(actualizado);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        // Link de un solo uso: ya había sido respondido antes de este click.
        // En vez de un error genérico, se recarga el estado real ya registrado.
        await cargar();
      } else {
        setError(mensajeError(err, "No se pudo registrar tu respuesta"));
      }
    } finally {
      setResponding(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando invitación...
          </div>
        ) : error && !data ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : data ? (
          <>
            <div className="flex flex-col items-center gap-2 text-center">
              {data.iglesia.logoUrl ? (
                <Image
                  src={data.iglesia.logoUrl}
                  alt={`Logo de ${data.iglesia.nombre}`}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full border border-border object-contain"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
              )}
              <p className="text-sm font-medium text-foreground">{data.iglesia.nombre}</p>
            </div>

            <div className="mt-6 border-t border-border pt-6 text-center">
              <p className="text-sm text-muted-foreground">Estás invitado(a) a</p>
              <h1 className="mt-1 text-lg font-semibold text-foreground">{data.evento.titulo}</h1>
              {data.evento.descripcion && (
                <p className="mt-2 text-sm text-muted-foreground">{data.evento.descripcion}</p>
              )}
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
              {data.evento.ubicacion && <p className="text-sm text-muted-foreground">{data.evento.ubicacion}</p>}
            </div>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="mt-6 space-y-3">
              {data.estado === "PENDIENTE" ? (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant={respuestaSugerida === "CONFIRMADO" ? "default" : "outline"}
                    onClick={() => responder("CONFIRMADO")}
                    disabled={responding}
                  >
                    {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Sí, voy a asistir
                  </Button>
                  <Button
                    className="flex-1"
                    variant={respuestaSugerida === "RECHAZADO" ? "destructive" : "outline"}
                    onClick={() => responder("RECHAZADO")}
                    disabled={responding}
                  >
                    {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    No podré asistir
                  </Button>
                </div>
              ) : (
                <>
                  <p
                    className={`rounded-lg px-4 py-3 text-center text-sm font-medium ${
                      data.estado === "CONFIRMADO" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {data.estado === "CONFIRMADO"
                      ? "Ya confirmaste tu asistencia."
                      : "Indicaste que no podrás asistir."}
                  </p>

                  {data.estado === "CONFIRMADO" && (
                    <Button asChild className="w-full" variant="outline">
                      <a href={data.googleCalendarLink} target="_blank" rel="noreferrer">
                        <Calendar className="h-4 w-4" />
                        Agregar a Google Calendar
                      </a>
                    </Button>
                  )}
                </>
              )}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

export default function AsistenciaEventoPage() {
  return (
    <Suspense fallback={<CargandoInvitacion />}>
      <AsistenciaEventoContent />
    </Suspense>
  );
}
