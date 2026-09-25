"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRealtimeEvent } from "@/hooks/use-realtime";
import { ApiError, apiFetch } from "@/lib/api";
import {
  ESTADO_ASISTENCIA_CLASS,
  ESTADO_ASISTENCIA_LABEL,
  ESTADO_PREDICADOR_CLASS,
  ESTADO_PREDICADOR_LABEL,
  type AsistenciaResumen,
  type ConvocatoriaResumen,
  type EstadoAsistencia,
  type Predicador,
} from "./types";

const GRUPOS: { estado: EstadoAsistencia; titulo: string }[] = [
  { estado: "CONFIRMADO", titulo: "Confirmaron" },
  { estado: "PENDIENTE", titulo: "Sin responder" },
  { estado: "RECHAZADO", titulo: "Rechazaron" },
];

interface ConvocatoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventoId: string | null;
  eventoTitulo: string;
}

export function ConvocatoriaDialog({ open, onOpenChange, eventoId, eventoTitulo }: ConvocatoriaDialogProps) {
  const [predicadores, setPredicadores] = useState<Predicador[]>([]);
  const [asistencias, setAsistencias] = useState<AsistenciaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !eventoId) return;
    setLoading(true);
    setError(null);

    apiFetch<ConvocatoriaResumen>(`/agenda/eventos/${eventoId}/convocatoria`)
      .then((data) => {
        setPredicadores(data.predicadores);
        setAsistencias(data.asistencias);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar el estado de la convocatoria"),
      )
      .finally(() => setLoading(false));
  }, [open, eventoId]);

  // Realtime (ver frontend/prompt.md): mientras el diálogo está abierto para
  // este evento, parcha en vivo la fila que responde. Los contadores por grupo
  // se derivan con `.filter`, se re-renderizan solos.
  useRealtimeEvent("predicador:respondio", (payload) => {
    if (!open || payload.eventoId !== eventoId) return;
    setPredicadores((prev) =>
      prev.map((p) =>
        p.id === payload.predicadorId ? { ...p, estado: payload.estado, respondidoAt: payload.respondidoAt } : p,
      ),
    );
  });

  useRealtimeEvent("asistencia:respondida", (payload) => {
    if (!open || payload.eventoId !== eventoId) return;
    setAsistencias((prev) =>
      prev.map((a) =>
        a.integranteId === payload.integranteId
          ? { ...a, estado: payload.estado, respondidoAt: payload.respondidoAt }
          : a,
      ),
    );
  });

  const sinConvocatoria = predicadores.length === 0 && asistencias.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Estado de la convocatoria — {eventoTitulo}</DialogTitle>
          <DialogDescription>Quién confirmó, rechazó o todavía no responde: predicadores y congregación.</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : sinConvocatoria ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No se invitó a ningún predicador ni se convocó a la congregación.
          </p>
        ) : (
          <div className="space-y-6">
            {predicadores.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground">Predicadores invitados ({predicadores.length})</p>
                <div className="mt-2 space-y-2">
                  {predicadores.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium text-foreground">{p.nombre || p.email}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_PREDICADOR_CLASS[p.estado]}`}
                      >
                        {ESTADO_PREDICADOR_LABEL[p.estado]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {asistencias.length > 0 && (
              <div className="space-y-5">
                <p className="text-sm font-medium text-foreground">Convocatoria a la congregación</p>
                {GRUPOS.map(({ estado, titulo }) => {
                  const integrantes = asistencias.filter((a) => a.estado === estado);
                  return (
                    <div key={estado}>
                      <p className="text-sm font-medium text-foreground">
                        {titulo} ({integrantes.length})
                      </p>
                      {integrantes.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">Nadie en este grupo.</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {integrantes.map((a) => (
                            <div
                              key={a.integranteId}
                              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{a.nombreCompleto}</p>
                                <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_ASISTENCIA_CLASS[a.estado]}`}
                              >
                                {ESTADO_ASISTENCIA_LABEL[a.estado]}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
