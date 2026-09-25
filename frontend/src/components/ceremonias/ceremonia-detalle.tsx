"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, Pencil, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { API_URL, ApiError, apiFetch } from "@/lib/api";
import type { SessionUser } from "@/stores/auth-store";
import { CeremoniaFormDialog } from "./ceremonia-form-dialog";
import { EliminarCeremoniaDialog } from "./eliminar-ceremonia-dialog";
import { CEREMONIA_CONFIGS, nombrePrincipal, type CeremoniaTipo, type RegistroCeremonia } from "./types";

// Mismo criterio que ceremonias-listado.tsx: CEREMONIAS es un módulo delegable.
function tieneAccesoCeremonias(usuario: SessionUser): boolean {
  return usuario.rol === "MANAGER" || usuario.modulos.includes("CEREMONIAS");
}

/** Extrae el nombre de archivo de `Content-Disposition: attachment; filename="..."`, si viene. */
function nombreArchivoDesdeHeader(res: Response, fallback: string): string {
  const header = res.headers.get("Content-Disposition");
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

interface CeremoniaDetalleProps {
  tipo: CeremoniaTipo;
}

export function CeremoniaDetalle({ tipo }: CeremoniaDetalleProps) {
  const config = CEREMONIA_CONFIGS[tipo];
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { usuario, ready } = useRequireAuth();

  const [registro, setRegistro] = useState<RegistroCeremonia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emitiendo, setEmitiendo] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [eliminarOpen, setEliminarOpen] = useState(false);

  const cargar = useCallback(async () => {
    if (!usuario || !params.id) return;
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<RegistroCeremonia>(`/ceremonias/${tipo}/${params.id}`);
      setRegistro(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el registro");
    } finally {
      setLoading(false);
    }
  }, [usuario, tipo, params.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function emitirCertificado() {
    if (!registro) return;
    setEmitiendo(true);
    setError(null);

    try {
      // GET, sin CSRF — descarga de blob, apiFetch no soporta respuestas no-JSON.
      const res = await fetch(`${API_URL}/ceremonias/${tipo}/${registro.id}/certificado`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();

      const nombreArchivo = nombreArchivoDesdeHeader(res, `certificado_${tipo}_${registro.folio}.pdf`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo descargar el certificado");
    } finally {
      setEmitiendo(false);
    }
  }

  function onEliminado() {
    router.replace(`/ceremonias/${tipo}`);
  }

  if (!ready || !usuario) {
    return null;
  }

  if (!tieneAccesoCeremonias(usuario)) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">No tienes permisos para ver esta página.</p>
        <Button asChild variant="outline">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </main>
    );
  }

  const Icon = config.icon;
  const nombre = registro ? nombrePrincipal(config, registro) : "";

  return (
    <main className="h-full bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/ceremonias/${tipo}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a {config.nombrePlural.toLowerCase()}
        </Link>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : registro ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            {/* Hero: el nombre de la persona/pareja es el momento cálido (mismo tratamiento
                que "¡Gracias, {nombre}!" en Integrantes); el folio es el dato protagonista
                del documento físico que este módulo reemplaza, así que recibe su propia
                insignia con peso visual propio en vez de quedar como subtítulo menor. */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {config.nombreSingular}
                  </p>
                  <h1 className="mt-0.5 text-balance font-display text-2xl italic text-primary sm:text-3xl">
                    {nombre || config.nombreSingular}
                  </h1>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2 sm:flex-col sm:items-end sm:justify-normal sm:gap-0.5 sm:text-right">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Folio</span>
                <span className="text-2xl font-semibold tabular-nums text-primary">N.° {registro.folio}</span>
              </div>
            </div>

            <dl className="mt-6 space-y-3 border-t border-border pt-6 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Fecha</dt>
                <dd className="text-right font-medium text-foreground">
                  {new Date(`${String(registro.fecha).slice(0, 10)}T00:00:00`).toLocaleDateString("es-CL", {
                    dateStyle: "long",
                  })}
                </dd>
              </div>
              {config.campos.map((campo) => (
                <div key={campo.name} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{campo.label}</dt>
                  <dd className="text-right font-medium text-foreground">{String(registro[campo.name] ?? "—")}</dd>
                </div>
              ))}
              <div className="border-t border-border pt-3" />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Registrado el</dt>
                <dd className="text-right font-medium text-foreground">
                  {new Date(registro.createdAt).toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" })}
                </dd>
              </div>
              {registro.updatedAt !== registro.createdAt && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Última edición</dt>
                  <dd className="text-right font-medium text-foreground">
                    {new Date(registro.updatedAt).toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" })}
                  </dd>
                </div>
              )}
            </dl>

            {/* Jerarquía: "Emitir certificado" es la acción primaria (el propósito central
                del módulo — reemplazar el libro físico), "Editar" es secundaria, y "Eliminar"
                queda deliberadamente más discreta (no se estira en mobile, así que no
                compite en tamaño con las otras dos ni siquiera cuando se apilan). */}
            <div className="mt-6 flex flex-col items-center gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
              <Button type="button" className="w-full sm:flex-1" onClick={emitirCertificado} disabled={emitiendo}>
                {emitiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Emitir certificado
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:flex-1"
                onClick={() => setEditarOpen(true)}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
              <Button type="button" variant="destructive" onClick={() => setEliminarOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <CeremoniaFormDialog
        tipo={tipo}
        open={editarOpen}
        onOpenChange={setEditarOpen}
        registro={registro}
        onSaved={setRegistro}
      />

      <EliminarCeremoniaDialog
        tipo={tipo}
        registro={registro}
        open={eliminarOpen}
        onOpenChange={setEliminarOpen}
        onEliminado={onEliminado}
      />
    </main>
  );
}
