"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";
import type { Departamento } from "./types";

interface DepartamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si viene, el diálogo edita (renombra) ese departamento; si no, crea uno nuevo. */
  departamento?: Departamento | null;
  onSaved: (departamento: Departamento) => void;
}

export function DepartamentoDialog({ open, onOpenChange, departamento, onSaved }: DepartamentoDialogProps) {
  const esEdicion = Boolean(departamento);

  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNombre(departamento?.nombre ?? "");
    setError(null);
  }, [open, departamento]);

  function handleOpenChange(nextOpen: boolean) {
    if (guardando) return;
    onOpenChange(nextOpen);
  }

  async function guardar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    setError(null);

    try {
      const resultado = await apiFetch<Departamento>(
        esEdicion ? `/finanzas/departamentos/${departamento!.id}` : "/finanzas/departamentos",
        {
          method: esEdicion ? "PATCH" : "POST",
          body: JSON.stringify({ nombre: nombre.trim() }),
        },
      );
      onSaved(resultado);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el departamento");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Renombrar departamento" : "Nuevo departamento"}</DialogTitle>
          <DialogDescription>
            {esEdicion
              ? "Los movimientos y categorías ya registrados en este departamento no cambian."
              : "Crea un sub-libro de finanzas para un departamento (ej. Música, Diaconía)."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="nombre-departamento">
            Nombre
          </label>
          <Input
            id="nombre-departamento"
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
            placeholder="Ej: Música"
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
          <Button type="button" className="flex-1" onClick={guardar} disabled={guardando || !nombre.trim()}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : esEdicion ? "Guardar cambios" : "Crear departamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
