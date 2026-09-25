"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";
import type { IglesiaDetalle } from "./types";

interface CambiarFacturacionDialogProps {
  iglesiaId: string;
  iglesiaNombre: string;
  /** Fecha en formato "YYYY-MM-DD", tal cual la entrega un <input type="date">. */
  nuevaFecha: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActualizado: (iglesia: IglesiaDetalle) => void;
}

function formatFechaCorta(fechaISO: string): string {
  const [year, month, day] = fechaISO.split("-");
  return `${day}/${month}/${year}`;
}

/** Mismo patrón que eliminar-ceremonia-dialog.tsx / eliminar-departamento-dialog.tsx
 * (password + DELETE), pero para un PATCH no destructivo (ver frontend/prompt.md,
 * sección 2 — ahora exige contraseña por el impacto en el corte de acceso por mora). */
export function CambiarFacturacionDialog({
  iglesiaId,
  iglesiaNombre,
  nuevaFecha,
  open,
  onOpenChange,
  onActualizado,
}: CambiarFacturacionDialogProps) {
  const [password, setPassword] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setError(null);
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    if (guardando) return;
    onOpenChange(nextOpen);
  }

  async function confirmar() {
    if (!password) return;
    setGuardando(true);
    setError(null);

    try {
      const actualizado = await apiFetch<IglesiaDetalle>(`/iglesias/${iglesiaId}/facturacion`, {
        method: "PATCH",
        body: JSON.stringify({ proximaFacturacion: nuevaFecha, password }),
      });
      onOpenChange(false);
      onActualizado(actualizado);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la fecha de facturación");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmar cambio de facturación</DialogTitle>
          <DialogDescription>
            Vas a cambiar la fecha de facturación de {iglesiaNombre} al {formatFechaCorta(nuevaFecha)}. Ingresa tu
            contraseña para confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="password-cambiar-facturacion">
            Contraseña
          </label>
          <Input
            id="password-cambiar-facturacion"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmar()}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="button" className="flex-1" onClick={confirmar} disabled={guardando || !password}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
