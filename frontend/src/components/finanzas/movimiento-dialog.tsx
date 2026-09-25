"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  formatoCLP,
  MEDIO_PAGO_LABEL,
  type Categoria,
  type ContextoFinanzas,
  type MedioPago,
  type Movimiento,
  type TipoMovimiento,
} from "./types";

const movimientoSchema = z.object({
  categoriaId: z.string().min(1, "Selecciona una categoría"),
  monto: z.coerce.number({ invalid_type_error: "Ingresa un monto" }).positive("Debe ser mayor a 0"),
  fecha: z.string().min(1, "Selecciona una fecha"),
  descripcion: z.string().min(1, "La descripción es obligatoria"),
});

type MovimientoValues = z.infer<typeof movimientoSchema>;

/** Modo del diálogo cuando se abre sobre un movimiento existente. */
type Modo = "ver" | "editar" | "confirmar" | "eliminar";

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatoFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

interface MovimientoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimiento?: Movimiento | null;
  categorias: Categoria[];
  /** Destino donde se crea el movimiento/categoría nueva — el departamento de
   * un movimiento existente es inmutable, así que solo se usa al crear. */
  contexto: ContextoFinanzas;
  onCategoriaCreada: (categoria: Categoria) => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export function MovimientoDialog({
  open,
  onOpenChange,
  movimiento,
  categorias,
  contexto,
  onCategoriaCreada,
  onSaved,
  onDeleted,
}: MovimientoDialogProps) {
  const usuario = useAuthStore((state) => state.usuario);
  const esEdicion = Boolean(movimiento);

  const [modo, setModo] = useState<Modo>("editar");
  const [pendingValues, setPendingValues] = useState<MovimientoValues | null>(null);
  const [guardandoConfirmacion, setGuardandoConfirmacion] = useState(false);

  const [tipo, setTipo] = useState<TipoMovimiento>("INGRESO");
  const [medioPago, setMedioPago] = useState<MedioPago>("EFECTIVO");
  const [serverError, setServerError] = useState<string | null>(null);
  const [passwordEliminar, setPasswordEliminar] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [nombreNuevaCategoria, setNombreNuevaCategoria] = useState("");
  const [creandoCategoriaLoading, setCreandoCategoriaLoading] = useState(false);
  // Copia local: al crear una categoría necesitamos que el nuevo <SelectItem>
  // exista en el MISMO render en que cambiamos el value seleccionado — si
  // dependiéramos solo del prop del padre, llegaría un render después y
  // Radix no tendría con qué mostrar la opción recién creada.
  const [categoriasLocal, setCategoriasLocal] = useState<Categoria[]>(categorias);
  // Radix Select solo registra sus <Item> mientras el dropdown está abierto —
  // si agregamos una categoría con el dropdown cerrado y le asignamos el value
  // por código, Radix nunca llega a registrarla y termina "corrigiendo" el
  // value de vuelta a "". Forzar un remount (cambiando key) resincroniza todo
  // en un solo golpe: value + opciones llegan juntos al Select nuevo.
  const [categoriaSelectKey, setCategoriaSelectKey] = useState(0);

  const form = useForm<MovimientoValues>({
    resolver: zodResolver(movimientoSchema),
    defaultValues: { categoriaId: "", monto: 0, fecha: "", descripcion: "" },
  });

  useEffect(() => {
    if (!open) return;

    setServerError(null);
    setCreandoCategoria(false);
    setNombreNuevaCategoria("");
    setCategoriasLocal(categorias);
    setCategoriaSelectKey(0);
    setPendingValues(null);
    setPasswordEliminar("");
    // Un movimiento existente siempre se abre primero en modo informativo:
    // quien lo abre debe ver quién y cuándo lo registró antes de poder editarlo.
    setModo(movimiento ? "ver" : "editar");

    if (movimiento) {
      setTipo(movimiento.tipo);
      setMedioPago(movimiento.medioPago);
      form.reset({
        categoriaId: movimiento.categoria.id,
        monto: Number(movimiento.monto),
        fecha: toDateInputValue(new Date(movimiento.fecha)),
        descripcion: movimiento.descripcion,
      });
    } else {
      setTipo("INGRESO");
      setMedioPago("EFECTIVO");
      form.reset({ categoriaId: "", monto: 0, fecha: toDateInputValue(new Date()), descripcion: "" });
    }
    // `categorias` a propósito no es dependencia: solo queremos tomar el snapshot
    // al abrir, no resetear el formulario cada vez que el padre actualiza su lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, movimiento, form]);

  const categoriasFiltradas = categoriasLocal.filter((c) => c.tipo === tipo);

  function cambiarTipo(nuevoTipo: TipoMovimiento) {
    setTipo(nuevoTipo);
    form.setValue("categoriaId", "");
  }

  async function crearCategoria() {
    if (!usuario || !nombreNuevaCategoria.trim()) return;
    setCreandoCategoriaLoading(true);
    setServerError(null);

    try {
      const nueva = await apiFetch<Categoria>("/finanzas/categorias", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombreNuevaCategoria.trim(),
          tipo,
          ...(contexto.tipo === "departamento" ? { departamentoId: contexto.id } : {}),
        }),
      });

      setCategoriasLocal((prev) => [...prev, nueva]);
      onCategoriaCreada(nueva);
      form.setValue("categoriaId", nueva.id, { shouldValidate: true, shouldDirty: true });
      setCategoriaSelectKey((k) => k + 1);
      setNombreNuevaCategoria("");
      setCreandoCategoria(false);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo crear la categoría");
    } finally {
      setCreandoCategoriaLoading(false);
    }
  }

  async function guardar(values: MovimientoValues) {
    if (!usuario) return;

    const body = {
      categoriaId: values.categoriaId,
      monto: values.monto,
      fecha: new Date(`${values.fecha}T00:00:00`).toISOString(),
      descripcion: values.descripcion,
      medioPago,
      // El departamento de un movimiento es inmutable tras crearlo — solo se
      // manda al crear, nunca en el PATCH de edición.
      ...(!esEdicion && contexto.tipo === "departamento" ? { departamentoId: contexto.id } : {}),
    };

    await apiFetch(esEdicion ? `/finanzas/movimientos/${movimiento!.id}` : "/finanzas/movimientos", {
      method: esEdicion ? "PATCH" : "POST",
      body: JSON.stringify(body),
    });

    onOpenChange(false);
    onSaved();
  }

  async function onSubmit(values: MovimientoValues) {
    setServerError(null);

    // Editar un movimiento existente exige confirmación explícita antes de
    // aplicar el cambio; crear uno nuevo se guarda directo.
    if (esEdicion) {
      setPendingValues(values);
      setModo("confirmar");
      return;
    }

    try {
      await guardar(values);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo guardar el movimiento");
    }
  }

  async function confirmarEdicion() {
    if (!pendingValues) return;
    setServerError(null);
    setGuardandoConfirmacion(true);

    try {
      await guardar(pendingValues);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo guardar el movimiento");
      setModo("editar");
    } finally {
      setGuardandoConfirmacion(false);
    }
  }

  async function confirmarEliminacion() {
    if (!usuario || !movimiento || !passwordEliminar) return;
    setDeleting(true);
    setServerError(null);

    try {
      await apiFetch(`/finanzas/movimientos/${movimiento.id}`, {
        method: "DELETE",
        body: JSON.stringify({ password: passwordEliminar }),
      });
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo eliminar el movimiento");
      setDeleting(false);
    }
  }

  const categoriaSeleccionada = pendingValues
    ? categoriasLocal.find((c) => c.id === pendingValues.categoriaId)
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {modo === "ver" && movimiento ? (
          <>
            <DialogHeader>
              <DialogTitle>Detalle del movimiento</DialogTitle>
              <DialogDescription>Información del registro, incluyendo quién y cuándo lo creó.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        movimiento.tipo === "INGRESO"
                          ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                          : "rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700"
                      }
                    >
                      {movimiento.tipo === "INGRESO" ? "Ingreso" : "Egreso"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {MEDIO_PAGO_LABEL[movimiento.medioPago]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-foreground">{movimiento.categoria.nombre}</p>
                </div>
                <p className="text-xl font-semibold text-foreground">
                  {formatoCLP.format(Number(movimiento.monto))}
                </p>
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Fecha del movimiento</dt>
                  <dd className="text-right font-medium text-foreground">
                    {new Date(movimiento.fecha).toLocaleDateString("es-CL", { dateStyle: "long" })}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Descripción</dt>
                  <dd className="text-right font-medium text-foreground">{movimiento.descripcion}</dd>
                </div>
                <div className="border-t border-border pt-3" />
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Registrado por</dt>
                  <dd className="text-right font-medium text-foreground">
                    {movimiento.creadoPor ? `${movimiento.creadoPor.nombre} ${movimiento.creadoPor.apellido}` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Registrado el</dt>
                  <dd className="text-right font-medium text-foreground">{formatoFechaHora(movimiento.createdAt)}</dd>
                </div>
                {movimiento.updatedAt !== movimiento.createdAt && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Última edición</dt>
                    <dd className="text-right font-medium text-foreground">{formatoFechaHora(movimiento.updatedAt)}</dd>
                  </div>
                )}
              </dl>

              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="destructive" onClick={() => setModo("eliminar")}>
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
              <Button type="button" className="flex-1" onClick={() => setModo("editar")}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            </DialogFooter>
          </>
        ) : modo === "eliminar" && movimiento ? (
          <>
            <DialogHeader>
              <DialogTitle>Confirmar eliminación</DialogTitle>
              <DialogDescription>
                Esta acción no se puede deshacer. Ingresa tu contraseña para confirmar que quieres eliminar este
                movimiento.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="password-eliminar-movimiento">
                Contraseña
              </label>
              <Input
                id="password-eliminar-movimiento"
                type="password"
                autoFocus
                value={passwordEliminar}
                onChange={(e) => setPasswordEliminar(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmarEliminacion()}
              />
            </div>

            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setModo("ver")} disabled={deleting}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={confirmarEliminacion}
                disabled={deleting || !passwordEliminar}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar definitivamente"}
              </Button>
            </DialogFooter>
          </>
        ) : modo === "confirmar" && pendingValues ? (
          <>
            <DialogHeader>
              <DialogTitle>Confirmar cambios</DialogTitle>
              <DialogDescription>Revisa los datos antes de guardar la edición del movimiento.</DialogDescription>
            </DialogHeader>

            <dl className="space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Categoría</dt>
                <dd className="text-right font-medium text-foreground">{categoriaSeleccionada?.nombre ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Medio de pago</dt>
                <dd className="text-right font-medium text-foreground">{MEDIO_PAGO_LABEL[medioPago]}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Monto</dt>
                <dd className="text-right font-medium text-foreground">{formatoCLP.format(pendingValues.monto)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Fecha</dt>
                <dd className="text-right font-medium text-foreground">
                  {new Date(`${pendingValues.fecha}T00:00:00`).toLocaleDateString("es-CL", { dateStyle: "long" })}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Descripción</dt>
                <dd className="text-right font-medium text-foreground">{pendingValues.descripcion}</dd>
              </div>
            </dl>

            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setModo("editar")} disabled={guardandoConfirmacion}>
                Volver
              </Button>
              <Button type="button" className="flex-1" onClick={confirmarEdicion} disabled={guardandoConfirmacion}>
                {guardandoConfirmacion ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar cambios"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{esEdicion ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
              <DialogDescription>Registra un ingreso o egreso con su categoría y fecha.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={tipo === "INGRESO" ? "default" : "outline"}
                onClick={() => cambiarTipo("INGRESO")}
              >
                Ingreso
              </Button>
              <Button type="button" variant={tipo === "EGRESO" ? "default" : "outline"} onClick={() => cambiarTipo("EGRESO")}>
                Egreso
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={medioPago === "EFECTIVO" ? "secondary" : "outline"}
                onClick={() => setMedioPago("EFECTIVO")}
              >
                Efectivo
              </Button>
              <Button
                type="button"
                variant={medioPago === "TRANSFERENCIA" ? "secondary" : "outline"}
                onClick={() => setMedioPago("TRANSFERENCIA")}
              >
                Transferencia
              </Button>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
                <FormField
                  control={form.control}
                  name="categoriaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select key={categoriaSelectKey} onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoriasFiltradas.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {creandoCategoria ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nombre de la categoría"
                      value={nombreNuevaCategoria}
                      onChange={(e) => setNombreNuevaCategoria(e.target.value)}
                    />
                    <Button type="button" variant="outline" onClick={crearCategoria} disabled={creandoCategoriaLoading}>
                      {creandoCategoriaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setCreandoCategoria(false)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreandoCategoria(true)}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nueva categoría
                  </button>
                )}

                <FormField
                  control={form.control}
                  name="monto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" min="0" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fecha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Input placeholder="¿En qué consiste este movimiento?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {serverError && (
                  <Alert variant="destructive">
                    <AlertDescription>{serverError}</AlertDescription>
                  </Alert>
                )}

                <DialogFooter className="gap-2 sm:gap-2">
                  {esEdicion && (
                    <Button type="button" variant="outline" onClick={() => setModo("ver")}>
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : esEdicion ? (
                      "Revisar cambios"
                    ) : (
                      "Crear movimiento"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
