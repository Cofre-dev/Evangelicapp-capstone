"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2, Upload } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_URL, ApiError, apiFetch } from "@/lib/api";
import type {
  ContextoFinanzas,
  Departamento,
  ImportarMovimientosErrorFila,
  ImportarMovimientosResultado,
} from "./types";

const VALOR_GENERAL = "general";

interface ImportarMovimientosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departamentosActivos: Departamento[];
  /** Destino preseleccionado = donde está parado el usuario al abrir el diálogo. */
  contextoInicial: ContextoFinanzas;
  onImportado: () => void;
}

export function ImportarMovimientosDialog({
  open,
  onOpenChange,
  departamentosActivos,
  contextoInicial,
  onImportado,
}: ImportarMovimientosDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [destino, setDestino] = useState(VALOR_GENERAL);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<ImportarMovimientosErrorFila[] | null>(null);
  const [resultado, setResultado] = useState<ImportarMovimientosResultado | null>(null);
  const [descargandoPlantilla, setDescargandoPlantilla] = useState<"xlsx" | "csv" | null>(null);

  useEffect(() => {
    if (!open) return;
    setDestino(contextoInicial.tipo === "departamento" ? contextoInicial.id : VALOR_GENERAL);
    setArchivo(null);
    setError(null);
    setErrores(null);
    setResultado(null);
    if (inputRef.current) inputRef.current.value = "";
    // Solo nos interesa el contexto al momento de abrir, no en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    if (importando) return;
    onOpenChange(nextOpen);
  }

  async function descargarPlantilla(formato: "xlsx" | "csv") {
    setDescargandoPlantilla(formato);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/finanzas/movimientos/plantilla?formato=${formato}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plantilla-movimientos.${formato}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo descargar la plantilla");
    } finally {
      setDescargandoPlantilla(null);
    }
  }

  async function importar() {
    if (!archivo) return;
    setImportando(true);
    setError(null);
    setErrores(null);

    const formData = new FormData();
    formData.append("archivo", archivo);
    if (destino !== VALOR_GENERAL) formData.append("departamentoId", destino);

    try {
      const data = await apiFetch<ImportarMovimientosResultado>("/finanzas/movimientos/importar", {
        method: "POST",
        body: formData,
      });
      setResultado(data);
      onImportado();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const body = err.body as { errores?: ImportarMovimientosErrorFila[] } | null;
        if (Array.isArray(body?.errores)) {
          setErrores(body.errores);
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof ApiError ? err.message : "No se pudo importar el archivo");
      }
    } finally {
      setImportando(false);
    }
  }

  function reintentar() {
    setResultado(null);
    setErrores(null);
    setError(null);
    setArchivo(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {resultado ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Importación completada
              </DialogTitle>
              <DialogDescription>
                Se importaron {resultado.importados} movimiento{resultado.importados === 1 ? "" : "s"}.
              </DialogDescription>
            </DialogHeader>

            {resultado.categoriasCreadas.length > 0 && (
              <Alert>
                <AlertDescription>
                  Se crearon automáticamente estas categorías nuevas — revísalas por si alguna fue un error de tipeo:{" "}
                  <strong>{resultado.categoriasCreadas.join(", ")}</strong>
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={reintentar}>
                Importar otro archivo
              </Button>
              <Button type="button" className="flex-1" onClick={() => onOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Importar movimientos</DialogTitle>
              <DialogDescription>
                Sube un archivo .xlsx o .csv (máx. 5 MB) con las columnas Fecha, Tipo, Categoría, Medio de pago, Monto y
                Descripción, en ese orden. Todo el archivo se importa a un único destino.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => descargarPlantilla("xlsx")}
                disabled={descargandoPlantilla !== null}
              >
                {descargandoPlantilla === "xlsx" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Plantilla .xlsx
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => descargarPlantilla("csv")}
                disabled={descargandoPlantilla !== null}
              >
                {descargandoPlantilla === "csv" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Plantilla .csv
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Destino</label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={VALOR_GENERAL}>Finanzas general</SelectItem>
                  {departamentosActivos.map((dep) => (
                    <SelectItem key={dep.id} value={dep.id}>
                      {dep.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="archivo-importar-movimientos">
                Archivo (.xlsx o .csv)
              </label>
              <input
                ref={inputRef}
                id="archivo-importar-movimientos"
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-foreground hover:file:bg-accent/80"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {errores && (
              <div className="space-y-2">
                <Alert variant="destructive">
                  <AlertDescription>
                    No se importó nada — corrige el archivo y vuelve a subirlo, reintentar es seguro.
                  </AlertDescription>
                </Alert>
                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">Mensaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errores.map((e, i) => (
                        <tr key={`${e.fila}-${i}`} className="border-t border-border">
                          <td className="px-3 py-2 font-medium text-foreground">{e.fila}</td>
                          <td className="px-3 py-2 text-muted-foreground">{e.mensaje}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={importando}>
                Cancelar
              </Button>
              <Button type="button" className="flex-1" onClick={importar} disabled={importando || !archivo}>
                {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
