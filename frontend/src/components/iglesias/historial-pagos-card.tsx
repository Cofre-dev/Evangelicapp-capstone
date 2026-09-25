"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, apiFetch } from "@/lib/api";
import type { HistorialPagoItem } from "./types";

/** `GET /iglesias/:id/historial-pagos` (ver frontend/prompt.md, sección 3) —
 * más reciente primero; el último elemento de la lista es siempre la fecha de
 * adquisición del plan, no un pago confirmado. */
export function HistorialPagosCard({ iglesiaId }: { iglesiaId: string }) {
  const [items, setItems] = useState<HistorialPagoItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<HistorialPagoItem[]>(`/iglesias/${iglesiaId}/historial-pagos`)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo cargar el historial de pagos"));
  }, [iglesiaId]);

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
      <div className="p-6 pb-0">
        <h2 className="text-sm font-medium text-foreground">Historial de pagos</h2>
      </div>

      {error ? (
        <Alert variant="destructive" className="mx-6 mt-4 mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !items ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando historial...
        </div>
      ) : items.length === 0 ? (
        <p className="p-6 pt-4 text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Registrado por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell className="text-foreground">{new Date(item.fecha).toLocaleDateString("es-CL")}</TableCell>
                <TableCell className="text-foreground">
                  {index === items.length - 1 ? "Adquisición del plan" : "Pago confirmado"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.registradoPor ? `${item.registradoPor.nombre} ${item.registradoPor.apellido}` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
