"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, apiFetch } from "@/lib/api";
import type { Integrante } from "./types";

interface EliminarIntegranteDialogProps {
  open: boolean;
  integrante: Integrante | null;
  onOpenChange: (open: boolean) => void;
  onEliminado: (id: string) => void;
}

export function EliminarIntegranteDialog({ open, integrante, onOpenChange, onEliminado }: EliminarIntegranteDialogProps) {
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (eliminando) return;
    onOpenChange(nextOpen);
    if (!nextOpen) setError(null);
  }

  async function confirmar() {
    if (!integrante) return;
    setEliminando(true);
    setError(null);
    try {
      await apiFetch(`/integrantes/${integrante.id}`, { method: "DELETE" });
      onEliminado(integrante.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar el integrante");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar integrante</DialogTitle>
          <DialogDescription>
            {integrante && (
              <>
                Vas a eliminar a <span className="font-medium text-foreground">{integrante.nombreCompleto}</span> del
                censo de tu iglesia. Esta acción no se puede deshacer.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={eliminando}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={confirmar} disabled={eliminando}>
            {eliminando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
