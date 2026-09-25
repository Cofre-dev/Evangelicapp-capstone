"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Building2, Check, Loader2, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";

type EstadoConfirmacion = "PENDIENTE" | "CONFIRMADO" | "RECHAZADO";

interface InvitacionPredicador {
  nombre: string | null;
  email: string;
  estado: EstadoConfirmacion;
  respondidoAt: string | null;
  evento: {
    titulo: string;
    fechaInicio: string;
    fechaFin: string;
    ubicacion: string | null;
  };
  iglesia: { nombre: string; logoUrl: string | null };
}

export default function PredicacionPage() {
  const params = useParams<{ token: string }>();

  const [data, setData] = useState<InvitacionPredicador | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (!params.token) return;

    apiFetch<InvitacionPredicador>(`/agenda/predicadores/${params.token}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo cargar la invitación"))
      .finally(() => setLoading(false));
  }, [params.token]);

  async function responder(respuesta: "CONFIRMADO" | "RECHAZADO") {
    if (!params.token) return;
    setResponding(true);
    setError(null);

    try {
      const actualizado = await apiFetch<InvitacionPredicador>(`/agenda/predicadores/${params.token}/responder`, {
        method: "POST",
        body: JSON.stringify({ respuesta }),
      });
      setData(actualizado);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar tu respuesta");
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
              <p className="text-sm text-muted-foreground">Has sido invitado a predicar en</p>
              <h1 className="mt-1 text-lg font-semibold text-foreground">{data.evento.titulo}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
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
              {data.estado === "CONFIRMADO" && (
                <p className="rounded-lg bg-emerald-100 px-4 py-3 text-center text-sm font-medium text-emerald-700">
                  Has confirmado tu participación.
                </p>
              )}
              {data.estado === "RECHAZADO" && (
                <p className="rounded-lg bg-red-100 px-4 py-3 text-center text-sm font-medium text-red-700">
                  Has indicado que no podrás participar.
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant={data.estado === "CONFIRMADO" ? "default" : "outline"}
                  onClick={() => responder("CONFIRMADO")}
                  disabled={responding}
                >
                  {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Sí, puedo
                </Button>
                <Button
                  className="flex-1"
                  variant={data.estado === "RECHAZADO" ? "destructive" : "outline"}
                  onClick={() => responder("RECHAZADO")}
                  disabled={responding}
                >
                  {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  No podré
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
