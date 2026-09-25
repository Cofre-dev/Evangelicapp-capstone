"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";
import type { Departamento } from "./types";

interface EliminarDepartamentoDialogProps {
  departamento: Departamento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEliminado: () => void;
  /** El 409 "tiene movimientos" ofrece archivar como salida en vez de eliminar. */
  onArchivarEnLugar: (departamento: Departamento) => void;
}

export function EliminarDepartamentoDialog({
  departamento,
  open,
  onOpenChange,
  onEliminado,
  onArchivarEnLugar,
}: EliminarDepartamentoDialogProps) {
  const [password, setPassword] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tieneMovimientos, setTieneMovimientos] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setError(null);
    setTieneMovimientos(false);
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    if (eliminando) return;
    onOpenChange(nextOpen);
  }

  async function confirmar() {
    if (!departamento || !password) return;
    setEliminando(true);
    setError(null);

    try {
      await apiFetch(`/finanzas/departamentos/${departamento.id}`, {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      onOpenChange(false);
      onEliminado();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setTieneMovimientos(true);
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : "No se pudo eliminar el departamento");
      }
      setEliminando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmar eliminación</DialogTitle>
          <DialogDescription>
            {departamento && (
              <>
                Vas a eliminar el departamento &ldquo;{departamento.nombre}&rdquo; definitivamente. Esta acción no se
                puede deshacer. Ingresa tu contraseña para confirmar.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!tieneMovimientos && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="password-eliminar-departamento">
              Contraseña
            </label>
            <Input
              id="password-eliminar-departamento"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmar()}
            />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={eliminando}>
            Cancelar
          </Button>
          {tieneMovimientos ? (
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                if (departamento) onArchivarEnLugar(departamento);
                onOpenChange(false);
              }}
            >
              Archivar en su lugar
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              onClick={confirmar}
              disabled={eliminando || !password}
            >
              {eliminando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar definitivamente"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
