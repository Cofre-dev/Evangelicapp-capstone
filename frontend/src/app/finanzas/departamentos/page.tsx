"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArchiveRestore, ArrowLeft, Archive, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DepartamentoDialog } from "@/components/finanzas/departamento-dialog";
import { EliminarDepartamentoDialog } from "@/components/finanzas/eliminar-departamento-dialog";
import type { Departamento } from "@/components/finanzas/types";
import { planTieneSubdepartamentos } from "@/components/iglesias/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { ApiError, apiFetch } from "@/lib/api";

// Gestión de departamentos (crear/renombrar/archivar/eliminar) no es un módulo
// delegable — exclusivo de MANAGER, igual que hoy (ver frontend/prompt.md). El
// acceso a los movimientos del libro sí es delegable vía FINANZAS (ver /finanzas).
const ROLES_CON_ACCESO = ["MANAGER"];

export default function GestionarDepartamentosPage() {
  const { usuario, ready } = useRequireAuth();

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archivando, setArchivando] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [departamentoEditar, setDepartamentoEditar] = useState<Departamento | null>(null);
  const [departamentoEliminar, setDepartamentoEliminar] = useState<Departamento | null>(null);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<Departamento[]>("/finanzas/departamentos?incluirInactivos=true");
      setDepartamentos(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los departamentos");
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirCreacion() {
    setDepartamentoEditar(null);
    setDialogOpen(true);
  }

  function abrirEdicion(departamento: Departamento) {
    setDepartamentoEditar(departamento);
    setDialogOpen(true);
  }

  function onGuardado(departamento: Departamento) {
    setDepartamentos((prev) => {
      const existe = prev.some((d) => d.id === departamento.id);
      return existe ? prev.map((d) => (d.id === departamento.id ? departamento : d)) : [...prev, departamento];
    });
  }

  async function toggleActivo(departamento: Departamento) {
    setArchivando(departamento.id);
    setError(null);

    try {
      const actualizado = await apiFetch<Departamento>(`/finanzas/departamentos/${departamento.id}`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !departamento.activo }),
      });
      onGuardado(actualizado);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el departamento");
    } finally {
      setArchivando(null);
    }
  }

  function onEliminado() {
    if (!departamentoEliminar) return;
    setDepartamentos((prev) => prev.filter((d) => d.id !== departamentoEliminar.id));
    setDepartamentoEliminar(null);
  }

  function onArchivarEnLugar(departamento: Departamento) {
    toggleActivo(departamento);
  }

  if (!ready || !usuario) {
    return null;
  }

  if (!ROLES_CON_ACCESO.includes(usuario.rol)) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">No tienes permisos para ver esta página.</p>
        <Button asChild variant="outline">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </main>
    );
  }

  // Básico/Medio no tienen acceso a subdepartamentos (ver frontend/prompt.md,
  // sección 9) — se oculta "Nuevo departamento" en vez de dejar llegar al 403.
  const puedeCrear = Boolean(usuario.iglesia && planTieneSubdepartamentos(usuario.iglesia.plan));

  return (
    <main className="h-full bg-background p-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/finanzas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Volver a Finanzas
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Gestionar departamentos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sub-libros opcionales de finanzas (ej. Música, Diaconía) con sus propias categorías y movimientos.
            </p>
          </div>
          {puedeCrear && (
            <Button onClick={abrirCreacion}>
              <Plus className="h-4 w-4" />
              Nuevo departamento
            </Button>
          )}
        </div>

        {!puedeCrear && (
          <Alert className="mt-6">
            <AlertDescription>
              Tu plan actual no incluye subdepartamentos de finanzas. Habla con contacto@evangelicapp.cl para subir de
              plan.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando...
            </div>
          ) : departamentos.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Todavía no hay departamentos. Usa &ldquo;Nuevo departamento&rdquo; para crear el primero.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departamentos.map((dep) => (
                  <TableRow key={dep.id}>
                    <TableCell className="font-medium text-foreground">{dep.nombre}</TableCell>
                    <TableCell>
                      <span
                        className={
                          dep.activo
                            ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                        }
                      >
                        {dep.activo ? "Activo" : "Archivado"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Renombrar ${dep.nombre}`} onClick={() => abrirEdicion(dep)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={dep.activo ? `Archivar ${dep.nombre}` : `Reactivar ${dep.nombre}`}
                          onClick={() => toggleActivo(dep)}
                          disabled={archivando === dep.id}
                        >
                          {archivando === dep.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : dep.activo ? (
                            <Archive className="h-4 w-4" />
                          ) : (
                            <ArchiveRestore className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Eliminar ${dep.nombre}`}
                          onClick={() => setDepartamentoEliminar(dep)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <DepartamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        departamento={departamentoEditar}
        onSaved={onGuardado}
      />

      <EliminarDepartamentoDialog
        departamento={departamentoEliminar}
        open={departamentoEliminar !== null}
        onOpenChange={(open) => !open && setDepartamentoEliminar(null)}
        onEliminado={onEliminado}
        onArchivarEnLugar={onArchivarEnLugar}
      />
    </main>
  );
}
