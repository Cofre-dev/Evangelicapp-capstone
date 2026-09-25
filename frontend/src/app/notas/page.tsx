"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  NotebookPen,
  Plus,
  X,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NotaDialog } from "@/components/notas/nota-dialog";
import type { Nota, TipoNota } from "@/components/notas/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { ApiError, apiFetch } from "@/lib/api";

function formatoFechaLimite(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

function formatoFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

function estaVencida(iso: string): boolean {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return new Date(iso) < hoy;
}

/** Avatar de iniciales — `Nota.asignadoA`/`creadoPor` no traen foto (a
 * diferencia de `equipo`, ver `components/notas/types.ts`), así que en vez de
 * inventar un campo que el backend no manda, se resuelve siempre con iniciales. */
function Iniciales({ nombre, apellido }: { nombre: string; apellido: string }) {
  const iniciales = `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
      {iniciales}
    </span>
  );
}

function TareaCard({
  nota,
  onToggle,
  onAprobar,
  onRechazar,
  onEdit,
  procesando,
}: {
  nota: Nota;
  onToggle: (nota: Nota) => void;
  onAprobar: (nota: Nota) => void;
  onRechazar: (nota: Nota) => void;
  onEdit: (nota: Nota) => void;
  procesando: boolean;
}) {
  const vencida = nota.estado === "PENDIENTE" && nota.fechaLimite !== null && estaVencida(nota.fechaLimite);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        {nota.estado === "EN_REVISION" ? (
          <div className="mt-0.5 shrink-0 text-amber-500" title="Esperando tu aprobación">
            <Clock className="h-5 w-5" />
          </div>
        ) : (
          <button
            type="button"
            aria-label={nota.estado === "COMPLETADA" ? "Marcar como pendiente" : "Marcar como completada"}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(nota);
            }}
            disabled={procesando}
            className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
          >
            {procesando ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : nota.estado === "COMPLETADA" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <Circle className="h-5 w-5" />
            )}
          </button>
        )}

        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(nota)}>
          <p
            className={
              nota.estado === "COMPLETADA"
                ? "break-words text-sm font-semibold text-muted-foreground line-through"
                : "break-words text-sm font-semibold text-foreground"
            }
          >
            {nota.titulo}
          </p>
          {nota.descripcion && (
            <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">{nota.descripcion}</p>
          )}
        </button>
      </div>

      {(nota.fechaLimite || nota.asignadoA || vencida || nota.archivado) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-8">
          {vencida && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Venció</span>
          )}
          {nota.fechaLimite && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {formatoFechaLimite(nota.fechaLimite)}
            </span>
          )}
          {nota.asignadoA && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              <Iniciales nombre={nota.asignadoA.nombre} apellido={nota.asignadoA.apellido} />
              {nota.asignadoA.nombre}
            </span>
          )}
          {nota.archivado && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <Archive className="h-3 w-3" />
              Archivado
            </span>
          )}
        </div>
      )}

      {nota.estado === "EN_REVISION" && (
        <div className="mt-3 flex justify-end gap-1.5 pl-8">
          <Button size="sm" variant="outline" onClick={() => onRechazar(nota)} disabled={procesando}>
            <X className="h-3.5 w-3.5" />
            Rechazar
          </Button>
          <Button size="sm" onClick={() => onAprobar(nota)} disabled={procesando}>
            {procesando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Aprobar
          </Button>
        </div>
      )}
    </div>
  );
}

interface ColumnaProps {
  titulo: string;
  dotClassName: string;
  notas: Nota[];
  emptyLabel: string;
  onCrear?: () => void;
  onToggle: (nota: Nota) => void;
  onAprobar: (nota: Nota) => void;
  onRechazar: (nota: Nota) => void;
  onEdit: (nota: Nota) => void;
  procesandoId: string | null;
}

function Columna({ titulo, dotClassName, notas, emptyLabel, onCrear, onToggle, onAprobar, onRechazar, onEdit, procesandoId }: ColumnaProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center gap-2 px-1">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClassName}`} />
        <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {notas.length}
        </span>
      </div>

      {onCrear && (
        <button
          type="button"
          onClick={onCrear}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva tarea
        </button>
      )}

      {notas.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {notas.map((nota) => (
            <TareaCard
              key={nota.id}
              nota={nota}
              onToggle={onToggle}
              onAprobar={onAprobar}
              onRechazar={onRechazar}
              onEdit={onEdit}
              procesando={procesandoId === nota.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotaCard({ nota, onEdit }: { nota: Nota; onEdit: (nota: Nota) => void }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(nota)}
      className="flex h-full min-w-0 flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
        <NotebookPen className="h-3 w-3" />
        Nota
      </span>

      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-foreground">{nota.titulo}</p>
        {nota.descripcion && (
          <p className="mt-1.5 line-clamp-3 whitespace-pre-line break-words text-sm text-muted-foreground">
            {nota.descripcion}
          </p>
        )}
      </div>

      {nota.creadoPor && (
        <div className="mt-auto flex w-full items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <Iniciales nombre={nota.creadoPor.nombre} apellido={nota.creadoPor.apellido} />
            <span className="truncate">
              {nota.creadoPor.nombre} {nota.creadoPor.apellido}
            </span>
          </div>
          <span className="shrink-0">{formatoFechaCorta(nota.createdAt)}</span>
        </div>
      )}
    </button>
  );
}

export default function NotasPage() {
  const { usuario, ready } = useRequireAuth();

  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [verArchivados, setVerArchivados] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [notaSeleccionada, setNotaSeleccionada] = useState<Nota | null>(null);
  const [tipoNuevo, setTipoNuevo] = useState<TipoNota>("RECORDATORIO");

  const loadNotas = useCallback(
    async (incluirArchivados: boolean) => {
      if (!usuario) return;
      setLoading(true);
      setError(null);

      try {
        const data = await apiFetch<Nota[]>(incluirArchivados ? "/notas?incluirArchivados=true" : "/notas");
        setNotas(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "No se pudieron cargar los recordatorios");
      } finally {
        setLoading(false);
      }
    },
    [usuario],
  );

  useEffect(() => {
    loadNotas(verArchivados);
  }, [loadNotas, verArchivados]);

  function abrirCreacion(tipo: TipoNota) {
    setTipoNuevo(tipo);
    setNotaSeleccionada(null);
    setDialogOpen(true);
  }

  function abrirEdicion(nota: Nota) {
    setNotaSeleccionada(nota);
    setDialogOpen(true);
  }

  function abrirEdicionNota(nota: Nota) {
    if (!window.confirm("¿Quieres editar esta nota?")) return;
    abrirEdicion(nota);
  }

  /** Una tarea completada abre directo en modo solo-lectura (la candada
   * `NotaDialog`, ver `soloLectura` ahí) — no tiene sentido pedir
   * confirmación para "editar" algo que no se va a poder cambiar. Para el
   * resto (pendiente/en revisión) sí se pide autorización antes de abrir,
   * mismo criterio que ya existía para notas largas en `abrirEdicionNota`. */
  function abrirEdicionTarea(nota: Nota) {
    if (nota.estado !== "COMPLETADA" && !window.confirm("¿Quieres editar esta tarea?")) return;
    abrirEdicion(nota);
  }

  async function actualizarEstado(nota: Nota, estado: "PENDIENTE" | "COMPLETADA") {
    if (!usuario) return;
    setProcesandoId(nota.id);

    try {
      const actualizada = await apiFetch<Nota>(`/notas/${nota.id}`, {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      });
      setNotas((prev) => prev.map((n) => (n.id === actualizada.id ? actualizada : n)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el recordatorio");
    } finally {
      setProcesandoId(null);
    }
  }

  function toggleEstado(nota: Nota) {
    actualizarEstado(nota, nota.estado === "COMPLETADA" ? "PENDIENTE" : "COMPLETADA");
  }

  if (!ready || !usuario) {
    return null;
  }

  if (usuario.rol !== "MANAGER") {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">No tienes permisos para ver esta página.</p>
        <Button asChild variant="outline">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </main>
    );
  }

  const recordatorios = notas.filter((n) => n.tipo === "RECORDATORIO");
  const notasLargas = notas.filter((n) => n.tipo === "NOTA" && !n.archivado);

  const pendientes = recordatorios.filter((n) => !n.archivado && n.estado === "PENDIENTE");
  const enRevision = recordatorios.filter((n) => !n.archivado && n.estado === "EN_REVISION");
  const completadas = recordatorios.filter((n) => !n.archivado && n.estado === "COMPLETADA");
  const archivados = recordatorios.filter((n) => n.archivado);

  return (
    <main className="h-full bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Notas</h1>
            <p className="mt-1 text-sm text-muted-foreground">Uso exclusivo del pastor.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setVerArchivados((prev) => !prev)}>
              {verArchivados ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {verArchivados ? "Ocultar archivados" : "Ver archivados"}
            </Button>
            <Button variant="outline" onClick={() => abrirCreacion("NOTA")}>
              <NotebookPen className="h-4 w-4" />
              Nueva nota
            </Button>
            <Button onClick={() => abrirCreacion("RECORDATORIO")}>
              <Plus className="h-4 w-4" />
              Nuevo recordatorio
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : (
          <div className="mt-6 space-y-10">
            <div
              className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${verArchivados ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
            >
              <Columna
                titulo="Pendientes"
                dotClassName="bg-amber-400"
                notas={pendientes}
                emptyLabel="No tienes pendientes. ¡Vas al día!"
                onCrear={() => abrirCreacion("RECORDATORIO")}
                onToggle={toggleEstado}
                onAprobar={(n) => actualizarEstado(n, "COMPLETADA")}
                onRechazar={(n) => actualizarEstado(n, "PENDIENTE")}
                onEdit={abrirEdicionTarea}
                procesandoId={procesandoId}
              />
              <Columna
                titulo="En revisión"
                dotClassName="bg-sky-400"
                notas={enRevision}
                emptyLabel="Nada esperando tu aprobación."
                onToggle={toggleEstado}
                onAprobar={(n) => actualizarEstado(n, "COMPLETADA")}
                onRechazar={(n) => actualizarEstado(n, "PENDIENTE")}
                onEdit={abrirEdicionTarea}
                procesandoId={procesandoId}
              />
              <Columna
                titulo="Completadas"
                dotClassName="bg-emerald-500"
                notas={completadas}
                emptyLabel="Todavía no hay recordatorios completados."
                onToggle={toggleEstado}
                onAprobar={(n) => actualizarEstado(n, "COMPLETADA")}
                onRechazar={(n) => actualizarEstado(n, "PENDIENTE")}
                onEdit={abrirEdicionTarea}
                procesandoId={procesandoId}
              />
              {verArchivados && (
                <Columna
                  titulo="Archivados"
                  dotClassName="bg-slate-400"
                  notas={archivados}
                  emptyLabel="No hay recordatorios archivados."
                  onToggle={toggleEstado}
                  onAprobar={(n) => actualizarEstado(n, "COMPLETADA")}
                  onRechazar={(n) => actualizarEstado(n, "PENDIENTE")}
                  onEdit={abrirEdicionTarea}
                  procesandoId={procesandoId}
                />
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Notas ({notasLargas.length})</h2>
              {notasLargas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay notas largas.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {notasLargas.map((nota) => (
                    <NotaCard key={nota.id} nota={nota} onEdit={abrirEdicionNota} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <NotaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        nota={notaSeleccionada}
        defaultTipo={tipoNuevo}
        onSaved={() => loadNotas(verArchivados)}
        onDeleted={() => loadNotas(verArchivados)}
      />
    </main>
  );
}
