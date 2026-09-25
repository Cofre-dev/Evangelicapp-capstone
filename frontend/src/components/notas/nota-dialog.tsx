"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { Nota, TipoNota } from "./types";

const notaSchema = z.object({
  titulo: z.string().min(1, "Ingresa un título"),
  descripcion: z.string().optional(),
  fechaLimite: z.string().optional(),
  asignadoAId: z.string().optional(),
});

type NotaValues = z.infer<typeof notaSchema>;

interface MiembroEquipo {
  id: string;
  nombre: string;
  apellido: string;
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface NotaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nota?: Nota | null;
  /** Tipo con el que abre al crear (el botón que lo disparó); al editar se usa el tipo de la nota. */
  defaultTipo?: TipoNota;
  onSaved: () => void;
  onDeleted: () => void;
}

export function NotaDialog({ open, onOpenChange, nota, defaultTipo = "RECORDATORIO", onSaved, onDeleted }: NotaDialogProps) {
  const usuario = useAuthStore((state) => state.usuario);
  const esEdicion = Boolean(nota);

  const [tipo, setTipo] = useState<TipoNota>(defaultTipo);
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [archivando, setArchivando] = useState(false);
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);

  const form = useForm<NotaValues>({
    resolver: zodResolver(notaSchema),
    defaultValues: { titulo: "", descripcion: "", fechaLimite: "", asignadoAId: "" },
  });

  useEffect(() => {
    if (!open) return;

    setServerError(null);
    setTipo(nota?.tipo ?? defaultTipo);

    if (nota) {
      form.reset({
        titulo: nota.titulo,
        descripcion: nota.descripcion ?? "",
        fechaLimite: nota.fechaLimite ? toDateInputValue(new Date(nota.fechaLimite)) : "",
        asignadoAId: nota.asignadoA?.id ?? "",
      });
    } else {
      form.reset({ titulo: "", descripcion: "", fechaLimite: "", asignadoAId: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nota, defaultTipo, form]);

  useEffect(() => {
    if (!open || !usuario) return;
    apiFetch<MiembroEquipo[]>("/usuarios")
      .then(setEquipo)
      .catch(() => setEquipo([]));
  }, [open, usuario]);

  const opcionesAsignacion = usuario
    ? [{ id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido }, ...equipo]
    : equipo;

  async function onSubmit(values: NotaValues) {
    if (!usuario || soloLectura) return;
    setServerError(null);

    const body = {
      tipo,
      titulo: values.titulo,
      descripcion: values.descripcion || undefined,
      fechaLimite: tipo === "RECORDATORIO" && values.fechaLimite ? new Date(`${values.fechaLimite}T00:00:00`).toISOString() : undefined,
      asignadoAId: tipo === "RECORDATORIO" ? values.asignadoAId || undefined : undefined,
    };

    try {
      await apiFetch(esEdicion ? `/notas/${nota!.id}` : "/notas", {
        method: esEdicion ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });

      onOpenChange(false);
      onSaved();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo guardar la nota");
    }
  }

  async function handleDelete() {
    if (!usuario || !nota) return;
    setDeleting(true);
    try {
      await apiFetch(`/notas/${nota.id}`, { method: "DELETE" });
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo eliminar la nota");
    } finally {
      // En `finally` (no solo en el catch): el diálogo sigue montado entre
      // aperturas (solo se oculta, `open` es un prop), así que si esto
      // quedaba en `true` tras un éxito, el botón de la SIGUIENTE nota que se
      // abriera nacía deshabilitado hasta recargar la página.
      setDeleting(false);
    }
  }

  async function handleArchivar() {
    if (!usuario || !nota) return;
    setArchivando(true);
    setServerError(null);
    try {
      await apiFetch(`/notas/${nota.id}/archivar`, { method: "PATCH" });
      onOpenChange(false);
      onSaved();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo archivar el recordatorio");
    } finally {
      setArchivando(false);
    }
  }

  async function handleDesarchivar() {
    if (!usuario || !nota) return;
    setArchivando(true);
    setServerError(null);
    try {
      await apiFetch(`/notas/${nota.id}/desarchivar`, { method: "PATCH" });
      onOpenChange(false);
      onSaved();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo desarchivar el recordatorio");
    } finally {
      setArchivando(false);
    }
  }

  const esRecordatorio = tipo === "RECORDATORIO";
  /** Una tarea completada ya cumplió su propósito: se puede archivar o
   * eliminar, pero no editar (a pedido explícito del fundador). Las notas
   * largas no tienen `estado` de flujo, así que nunca quedan de solo lectura. */
  const soloLectura = Boolean(esEdicion && nota && esRecordatorio && nota.estado === "COMPLETADA");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-xl">
            {esEdicion ? "Editar" : "Nuevo"} {esRecordatorio ? "recordatorio" : "nota"}
          </DialogTitle>
          <DialogDescription>
            {soloLectura
              ? "Esta tarea ya fue completada y no se puede modificar. Puedes archivarla o eliminarla."
              : esRecordatorio
                ? "Tarea corta con fecha límite, asignable a tu equipo."
                : "Nota larga de uso personal."}
          </DialogDescription>
        </DialogHeader>

        {!esEdicion && (
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={tipo === "RECORDATORIO" ? "default" : "outline"} onClick={() => setTipo("RECORDATORIO")}>
              Recordatorio
            </Button>
            <Button type="button" variant={tipo === "NOTA" ? "default" : "outline"} onClick={() => setTipo("NOTA")}>
              Nota larga
            </Button>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Comprar elementos para la cena de confraternidad" disabled={soloLectura} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{esRecordatorio ? "Descripción (opcional)" : "Contenido"}</FormLabel>
                  <FormControl>
                    {esRecordatorio ? (
                      <Input disabled={soloLectura} {...field} />
                    ) : (
                      <Textarea rows={8} disabled={soloLectura} {...field} />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {esRecordatorio && (
              <>
                <FormField
                  control={form.control}
                  name="fechaLimite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha límite (opcional)</FormLabel>
                      <FormControl>
                        <Input type="date" disabled={soloLectura} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="asignadoAId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asignar a</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={soloLectura}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sin asignar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {opcionesAsignacion.map((miembro) => (
                            <SelectItem key={miembro.id} value={miembro.id}>
                              {usuario && miembro.id === usuario.id ? "Yo mismo" : `${miembro.nombre} ${miembro.apellido}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {esEdicion && nota && esRecordatorio && (
              <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                {nota.archivado ? (
                  <Button type="button" variant="outline" size="sm" onClick={handleDesarchivar} disabled={archivando}>
                    {archivando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
                    Desarchivar
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleArchivar}
                      disabled={archivando || nota.estado !== "COMPLETADA"}
                    >
                      {archivando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                      Archivar
                    </Button>
                    {nota.estado !== "COMPLETADA" && (
                      <p className="text-xs text-muted-foreground">Solo se pueden archivar recordatorios completados.</p>
                    )}
                  </>
                )}
              </div>
            )}

            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              {esEdicion && (
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Eliminar
                </Button>
              )}
              {!soloLectura && (
                <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : esEdicion ? (
                    "Guardar cambios"
                  ) : esRecordatorio ? (
                    "Crear recordatorio"
                  ) : (
                    "Guardar nota"
                  )}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
