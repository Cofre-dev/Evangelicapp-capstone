"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API_URL, ApiError, apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  ACCION_AUDITORIA_LABEL,
  contextoQueryParam,
  formatoCLP,
  MEDIO_PAGO_LABEL,
  type ContextoFinanzas,
  type MovimientoAuditLog,
} from "./types";

const ACCION_CLASS: Record<MovimientoAuditLog["accion"], string> = {
  CREACION: "bg-emerald-100 text-emerald-700",
  EDICION: "bg-sky-100 text-sky-700",
  ELIMINACION: "bg-red-100 text-red-700",
};

function formatoFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" });
}

interface LogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contexto: ContextoFinanzas;
}

export function LogsDialog({ open, onOpenChange, contexto }: LogsDialogProps) {
  const usuario = useAuthStore((state) => state.usuario);
  const [logs, setLogs] = useState<MovimientoAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<"actual" | "consolidado" | null>(null);

  async function descargarLogs(query: string, tipo: "actual" | "consolidado") {
    setDescargando(tipo);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/finanzas/movimientos/logs/exportar${query ? `?${query}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "logs-auditoria.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo descargar el archivo");
    } finally {
      setDescargando(null);
    }
  }

  useEffect(() => {
    if (!open || !usuario) return;
    setLoading(true);
    setError(null);

    apiFetch<MovimientoAuditLog[]>(`/finanzas/movimientos/logs?${contextoQueryParam(contexto)}`)
      .then(setLogs)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudieron cargar los logs"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, usuario, contexto.tipo, contexto.tipo === "departamento" ? contexto.id : null]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Historial de movimientos</DialogTitle>
          <DialogDescription>Quién agregó, editó o eliminó cada ingreso o egreso.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => descargarLogs(contextoQueryParam(contexto), "actual")}
            disabled={descargando !== null}
          >
            {descargando === "actual" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar logs
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => descargarLogs("", "consolidado")}
            disabled={descargando !== null}
          >
            {descargando === "consolidado" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Descargar todo consolidado
          </Button>
        </div>

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
        ) : logs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Todavía no hay movimientos registrados.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACCION_CLASS[log.accion]}`}>
                      {ACCION_AUDITORIA_LABEL[log.accion]}
                    </span>
                    <span className="font-medium text-foreground">
                      {log.usuario ? `${log.usuario.nombre} ${log.usuario.apellido}` : "Usuario eliminado"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatoFechaHora(log.createdAt)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {log.snapshot.categoria} · {formatoCLP.format(log.snapshot.monto)} ·{" "}
                  {MEDIO_PAGO_LABEL[log.snapshot.medioPago]} · {log.snapshot.departamento ?? "Finanzas general"}
                  {log.snapshot.descripcion && ` · ${log.snapshot.descripcion}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
