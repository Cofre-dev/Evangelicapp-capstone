"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";
import { CEREMONIA_CONFIGS, nombrePrincipal, type CeremoniaTipo, type RegistroCeremonia } from "./types";

interface EliminarCeremoniaDialogProps {
  tipo: CeremoniaTipo;
  registro: RegistroCeremonia | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEliminado: () => void;
}

export function EliminarCeremoniaDialog({ tipo, registro, open, onOpenChange, onEliminado }: EliminarCeremoniaDialogProps) {
  const config = CEREMONIA_CONFIGS[tipo];

  const [password, setPassword] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setError(null);
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    if (eliminando) return;
    onOpenChange(nextOpen);
  }

  async function confirmar() {
    if (!registro || !password) return;
    setEliminando(true);
    setError(null);

    try {
      await apiFetch(`/ceremonias/${tipo}/${registro.id}`, {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      onOpenChange(false);
      onEliminado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar el registro");
      setEliminando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmar eliminación</DialogTitle>
          <DialogDescription>
            {registro && (
              <>
                Vas a eliminar el registro de {config.nombreSingular.toLowerCase()}
                {nombrePrincipal(config, registro) ? ` de ${nombrePrincipal(config, registro)}` : ""} (folio N.°{" "}
                {registro.folio}). Esta acción no se puede deshacer. Ingresa tu contraseña para confirmar.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="password-eliminar-ceremonia">
            Contraseña
          </label>
          <Input
            id="password-eliminar-ceremonia"
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
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={eliminando}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" className="flex-1" onClick={confirmar} disabled={eliminando || !password}>
            {eliminando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
