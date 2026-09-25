"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { IdCard, Loader2, Mail, Phone, Trash2, User } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EliminarIntegranteDialog } from "@/components/integrantes/eliminar-integrante-dialog";
import { QrDialog } from "@/components/integrantes/qr-dialog";
import type { Integrante } from "@/components/integrantes/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { ApiError, apiFetch } from "@/lib/api";

// INTEGRANTES es uno de los 4 módulos delegables (ver frontend/prompt.md, brief
// del rename de roles): el MANAGER siempre tiene acceso; un USUARIO solo si el
// MANAGER se lo otorgó desde /accesos.
function tieneAccesoIntegrantes(usuario: { rol: string; modulos: string[] }): boolean {
  return usuario.rol === "MANAGER" || usuario.modulos.includes("INTEGRANTES");
}

// "Miembro desde" ahora es una fecha elegida por la persona (puede venir como
// YYYY-MM-DD o ISO completo) en vez de un año derivado de createdAt. Mientras
// el backend no soporte el campo (ver frontend/FEATURES.md), puede llegar
// vacío — se muestra un placeholder en vez de "Invalid Date".
function formatearMiembroDesde(fecha: string): string {
  if (!fecha) return "Sin registrar";
  const valor = fecha.includes("T") ? fecha : `${fecha}T00:00:00`;
  return new Date(valor).toLocaleDateString("es-CL");
}

export default function IntegrantesPage() {
  const { usuario, ready } = useRequireAuth();

  const [integrantes, setIntegrantes] = useState<Integrante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eliminarDialogOpen, setEliminarDialogOpen] = useState(false);
  const [paraEliminar, setParaEliminar] = useState<Integrante | null>(null);

  const tieneAcceso = Boolean(usuario && tieneAccesoIntegrantes(usuario));

  const cargarIntegrantes = useCallback(async () => {
    if (!usuario || !tieneAcceso) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Integrante[]>("/integrantes");
      setIntegrantes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el listado de integrantes");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, tieneAcceso]);

  useEffect(() => {
    cargarIntegrantes();
  }, [cargarIntegrantes]);

  function abrirEliminar(integrante: Integrante) {
    setParaEliminar(integrante);
    setEliminarDialogOpen(true);
  }

  function onEliminado(id: string) {
    setIntegrantes((prev) => prev.filter((i) => i.id !== id));
  }

  if (!ready || !usuario) {
    return null;
  }

  if (!tieneAcceso) {
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
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Integrantes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Censo de tu congregación, registrado por quienes escanean el QR de tu iglesia.
            </p>
          </div>
          <QrDialog />
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-10 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando integrantes...
          </div>
        ) : integrantes.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
            Todavía nadie se ha registrado. Comparte el código QR con tu congregación para empezar.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {integrantes.map((integrante) => (
              <article
                key={integrante.id}
                className="group relative flex flex-col items-center rounded-3xl border border-border bg-card p-6 pt-8 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => abrirEliminar(integrante)}
                  aria-label={`Eliminar a ${integrante.nombreCompleto}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                {/* Foto protagonista: halo con blur + anillo en degradé de la paleta
                    primaria (mismo lenguaje que el blob decorativo del hero del home,
                    aquí concentrado detrás del avatar en vez de flotando en el fondo). */}
                <div className="relative">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10 scale-125 rounded-full bg-[hsl(var(--primary)/0.35)] blur-xl transition-opacity group-hover:opacity-80"
                  />
                  <div className="rounded-full bg-[linear-gradient(135deg,hsl(199_84%_62%),hsl(203_66%_42%))] p-[3px] shadow-md">
                    {integrante.fotoUrl ? (
                      <Image
                        src={integrante.fotoUrl}
                        alt={integrante.nombreCompleto}
                        width={96}
                        height={96}
                        className="h-24 w-24 rounded-full border-2 border-card object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-card bg-accent text-primary">
                        <User className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                </div>

                <h2 className="mt-4 text-balance font-display text-2xl italic text-primary">
                  {integrante.nombreCompleto}
                </h2>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Miembro desde {formatearMiembroDesde(integrante.miembroDesde)}
                </p>

                <dl className="mt-5 w-full space-y-2.5 border-t border-border pt-5 text-left">
                  <div className="flex items-center gap-2.5 text-sm">
                    <IdCard className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <dt className="sr-only">RUN</dt>
                    <dd className="truncate text-foreground">{integrante.run || "Sin registrar"}</dd>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <dt className="sr-only">Correo</dt>
                    <dd className="truncate text-foreground">{integrante.email}</dd>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <dt className="sr-only">Teléfono</dt>
                    <dd className="truncate text-foreground">{integrante.telefono}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </div>

      <EliminarIntegranteDialog
        open={eliminarDialogOpen}
        integrante={paraEliminar}
        onOpenChange={setEliminarDialogOpen}
        onEliminado={onEliminado}
      />
    </main>
  );
}
