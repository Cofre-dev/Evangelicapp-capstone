"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { Nota } from "./types";

function formatoFechaLimite(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "long" });
}

function estaVencida(iso: string): boolean {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return new Date(iso) < hoy;
}

interface MisTareasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tareas: Nota[];
  onTareaActualizada: (tarea: Nota) => void;
}

export function MisTareasModal({ open, onOpenChange, tareas, onTareaActualizada }: MisTareasModalProps) {
  const usuario = useAuthStore((state) => state.usuario);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function marcarHecha(tarea: Nota) {
    if (!usuario) return;
    setProcesandoId(tarea.id);
    setError(null);

    try {
      const actualizada = await apiFetch<Nota>(`/notas/${tarea.id}/marcar-hecha`, {
        method: "PATCH",
      });
      onTareaActualizada(actualizada);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar la tarea");
    } finally {
      setProcesandoId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tus tareas</DialogTitle>
          <DialogDescription>Tareas que el pastor te asignó. Se quitan de aquí cuando él las aprueba.</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {tareas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No tienes tareas pendientes. ¡Vas al día!</p>
        ) : (
          <div className="space-y-3">
            {tareas.map((tarea) => {
              const vencida = tarea.estado === "PENDIENTE" && tarea.fechaLimite !== null && estaVencida(tarea.fechaLimite);
              return (
                <div key={tarea.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-sm font-semibold text-foreground">{tarea.titulo}</p>
                  {tarea.descripcion && <p className="mt-1 text-sm text-muted-foreground">{tarea.descripcion}</p>}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {tarea.fechaLimite && (
                      <span
                        className={
                          vencida
                            ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                            : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {vencida ? "Venció" : "Vence"} el {formatoFechaLimite(tarea.fechaLimite)}
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    {tarea.estado === "EN_REVISION" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                        <Clock className="h-3.5 w-3.5" />
                        Esperando aprobación del pastor
                      </span>
                    ) : (
                      <Button size="sm" onClick={() => marcarHecha(tarea)} disabled={procesandoId === tarea.id}>
                        {procesandoId === tarea.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Marcar como hecha
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
