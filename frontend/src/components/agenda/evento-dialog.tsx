"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Trash2, Users, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRealtimeEvent } from "@/hooks/use-realtime";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { ConvocatoriaDialog } from "./convocatoria-dialog";
import {
  ESTADO_PREDICADOR_CLASS,
  ESTADO_PREDICADOR_LABEL,
  TIPO_EVENTO_LABEL,
  type Evento,
  type Predicador,
  type TipoEvento,
} from "./types";

const eventoSchema = z
  .object({
    titulo: z.string().min(1, "Ingresa un título"),
    tipo: z.enum(["CULTO", "REUNION", "LIMPIEZA", "OTRO"], { errorMap: () => ({ message: "Selecciona un tipo" }) }),
    fecha: z.string().min(1, "Selecciona una fecha"),
    horaInicio: z.string().min(1, "Selecciona la hora de inicio"),
    horaFin: z.string().min(1, "Selecciona la hora de término"),
    ubicacion: z.string().optional(),
    descripcion: z.string().optional(),
    notificarIntegrantes: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (!data.fecha || !data.horaInicio || !data.horaFin) return true;
      const inicio = new Date(`${data.fecha}T${data.horaInicio}:00`);
      const fin = new Date(`${data.fecha}T${data.horaFin}:00`);
      return fin > inicio;
    },
    { message: "Debe ser posterior a la hora de inicio", path: ["horaFin"] },
  );

type EventoValues = z.infer<typeof eventoSchema>;

interface PredicadorNuevo {
  email: string;
  nombre: string;
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toTimeInputValue(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function combineDateTime(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}:00`).toISOString();
}

function seSuperponen(aInicio: Date, aFin: Date, bInicio: Date, bFin: Date): boolean {
  return aInicio < bFin && bInicio < aFin;
}

function buscarConflictos(eventos: Evento[], fechaInicio: Date, fechaFin: Date, excluirId?: string): Evento[] {
  return eventos.filter((e) => {
    if (e.id === excluirId) return false;
    return seSuperponen(fechaInicio, fechaFin, new Date(e.fechaInicio), new Date(e.fechaFin));
  });
}

interface EventoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  evento?: Evento | null;
  /** Eventos ya cargados del mes visible — se usan solo para avisar de choques de horario. */
  eventosExistentes: Evento[];
  onSaved: () => void;
  onDeleted: () => void;
}

type Step = "form" | "conflicto";

export function EventoDialog({
  open,
  onOpenChange,
  defaultDate,
  evento,
  eventosExistentes,
  onSaved,
  onDeleted,
}: EventoDialogProps) {
  const usuario = useAuthStore((state) => state.usuario);
  const esEdicion = Boolean(evento);

  const [step, setStep] = useState<Step>("form");
  const [conflictos, setConflictos] = useState<Evento[]>([]);
  const [pendingValues, setPendingValues] = useState<EventoValues | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [predicadoresNuevos, setPredicadoresNuevos] = useState<PredicadorNuevo[]>([]);
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [convocatoriaOpen, setConvocatoriaOpen] = useState(false);
  const [predicadores, setPredicadores] = useState<Predicador[]>([]);

  const form = useForm<EventoValues>({
    resolver: zodResolver(eventoSchema),
    defaultValues: {
      titulo: "",
      tipo: "CULTO",
      fecha: "",
      horaInicio: "09:00",
      horaFin: "10:00",
      ubicacion: "",
      descripcion: "",
      notificarIntegrantes: false,
    },
  });

  useEffect(() => {
    if (!open) return;

    setStep("form");
    setConflictos([]);
    setPendingValues(null);
    setServerError(null);
    setPredicadoresNuevos([]);
    setNuevoEmail("");
    setNuevoNombre("");
    setPredicadores(evento?.predicadores ?? []);

    if (evento) {
      const inicio = new Date(evento.fechaInicio);
      const fin = new Date(evento.fechaFin);
      form.reset({
        titulo: evento.titulo,
        tipo: evento.tipo,
        fecha: toDateInputValue(inicio),
        horaInicio: toTimeInputValue(inicio),
        horaFin: toTimeInputValue(fin),
        ubicacion: evento.ubicacion ?? "",
        descripcion: evento.descripcion ?? "",
        notificarIntegrantes: false,
      });
    } else {
      const base = defaultDate ?? new Date();
      form.reset({
        titulo: "",
        tipo: "CULTO",
        fecha: toDateInputValue(base),
        horaInicio: "09:00",
        horaFin: "10:00",
        ubicacion: "",
        descripcion: "",
        notificarIntegrantes: false,
      });
    }
  }, [open, evento, defaultDate, form]);

  // Realtime (ver frontend/prompt.md): el predicador respondió desde el link
  // del email — actualiza el badge sin recargar, solo si el evento que
  // responde es el que está abierto en este diálogo en modo edición.
  useRealtimeEvent("predicador:respondio", (payload) => {
    if (!open || !esEdicion || !evento || payload.eventoId !== evento.id) return;
    setPredicadores((prev) =>
      prev.map((p) =>
        p.id === payload.predicadorId ? { ...p, estado: payload.estado, respondidoAt: payload.respondidoAt } : p,
      ),
    );
  });

  const tipoSeleccionado = form.watch("tipo");
  const notificarIntegrantes = form.watch("notificarIntegrantes");

  function agregarPredicador() {
    const email = nuevoEmail.trim();
    if (!email) return;
    setPredicadoresNuevos((prev) => [...prev, { email, nombre: nuevoNombre.trim() }]);
    setNuevoEmail("");
    setNuevoNombre("");
  }

  function quitarPredicador(index: number) {
    setPredicadoresNuevos((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(values: EventoValues) {
    const inicio = new Date(`${values.fecha}T${values.horaInicio}:00`);
    const fin = new Date(`${values.fecha}T${values.horaFin}:00`);
    const encontrados = buscarConflictos(eventosExistentes, inicio, fin, evento?.id);

    if (encontrados.length > 0) {
      setConflictos(encontrados);
      setPendingValues(values);
      setStep("conflicto");
      return;
    }

    await guardar(values);
  }

  async function guardar(values: EventoValues) {
    if (!usuario) return;
    setServerError(null);

    const body = {
      titulo: values.titulo,
      tipo: values.tipo,
      fechaInicio: combineDateTime(values.fecha, values.horaInicio),
      fechaFin: combineDateTime(values.fecha, values.horaFin),
      ubicacion: values.ubicacion || undefined,
      descripcion: values.descripcion || undefined,
      ...(esEdicion
        ? {}
        : {
            predicadores: values.tipo === "CULTO" && predicadoresNuevos.length > 0 ? predicadoresNuevos : undefined,
            notificarIntegrantes: values.notificarIntegrantes ?? false,
          }),
    };

    try {
      await apiFetch(esEdicion ? `/agenda/eventos/${evento!.id}` : "/agenda/eventos", {
        method: esEdicion ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });

      onOpenChange(false);
      onSaved();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo guardar el evento");
    }
  }

  async function handleDelete() {
    if (!usuario || !evento) return;
    setDeleting(true);
    try {
      await apiFetch(`/agenda/eventos/${evento.id}`, { method: "DELETE" });
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo eliminar el evento");
      setDeleting(false);
    }
  }

  async function confirmarConTodo() {
    if (!pendingValues) return;
    await guardar(pendingValues);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {step === "conflicto" ? (
          <>
            <DialogHeader>
              <DialogTitle>Ya hay algo agendado a esa hora</DialogTitle>
              <DialogDescription>
                {conflictos.length === 1
                  ? `Ya existe "${conflictos[0].titulo}" que se cruza con este horario.`
                  : `Hay ${conflictos.length} eventos que se cruzan con este horario.`}{" "}
                ¿Deseas continuar de todos modos?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {conflictos.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">{c.titulo}</span>
                  <span className="ml-2 text-muted-foreground">
                    {new Date(c.fechaInicio).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    {" – "}
                    {new Date(c.fechaFin).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>

            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("form")}>
                Cancelar
              </Button>
              <Button type="button" className="flex-1" onClick={confirmarConTodo} disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar de todos modos"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{esEdicion ? "Editar evento" : "Nuevo evento"}</DialogTitle>
              <DialogDescription>
                {esEdicion ? "Actualiza los datos del evento." : "Programa un culto, reunión o limpieza."}
              </DialogDescription>
            </DialogHeader>

            {esEdicion && evento?.notificarIntegrantes && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-sky-100 px-3 py-2 text-sm font-medium text-sky-700">
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0" />
                  Se avisó a la congregación por correo
                </span>
                <button
                  type="button"
                  onClick={() => setConvocatoriaOpen(true)}
                  className="flex items-center gap-1 rounded-full bg-sky-200/70 px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-200"
                >
                  <Users className="h-3.5 w-3.5" />
                  Ver quién confirmó
                </button>
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
                    <Input placeholder="Culto dominical" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(TIPO_EVENTO_LABEL) as TipoEvento[]).map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {TIPO_EVENTO_LABEL[tipo]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <Input type="date" min={toDateInputValue(new Date())} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="horaInicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora inicio</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="horaFin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora término</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="ubicacion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ubicación (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Templo principal" {...field} />
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
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!esEdicion && (
              <FormField
                control={form.control}
                name="notificarIntegrantes"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-x-2 space-y-0 rounded-lg border border-border bg-muted/40 p-3">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-normal">Avisar a la congregación por correo</FormLabel>
                      <FormDescription>
                        Se enviará un correo a cada Integrante registrado con un link para confirmar asistencia.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}

            {tipoSeleccionado === "CULTO" && (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Predicadores</p>

                {esEdicion ? (
                  predicadores.length > 0 ? (
                    <div className="space-y-2">
                      {predicadores.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                        >
                          <span className="text-foreground">{p.nombre || p.email}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_PREDICADOR_CLASS[p.estado]}`}
                          >
                            {ESTADO_PREDICADOR_LABEL[p.estado]}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No se invitó a ningún predicador.</p>
                  )
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Correo del predicador"
                        value={nuevoEmail}
                        onChange={(e) => setNuevoEmail(e.target.value)}
                      />
                      <Input
                        placeholder="Nombre (opcional)"
                        value={nuevoNombre}
                        onChange={(e) => setNuevoNombre(e.target.value)}
                      />
                      <Button type="button" variant="outline" onClick={agregarPredicador}>
                        Agregar
                      </Button>
                    </div>

                    {predicadoresNuevos.length > 0 && (
                      <div className="space-y-2">
                        {predicadoresNuevos.map((p, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                          >
                            <span className="text-foreground">{p.nombre || p.email}</span>
                            <button
                              type="button"
                              onClick={() => quitarPredicador(i)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Se les enviará un correo con un link para confirmar o rechazar.
                      {notificarIntegrantes && (
                        <>
                          {" "}
                          El nombre aparece en el correo a la congregación. Sin nombre, no se menciona al predicador.
                        </>
                      )}
                    </p>
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
              <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : esEdicion ? (
                  "Guardar cambios"
                ) : (
                  "Crear evento"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
          </>
        )}
      </DialogContent>

      {evento && (
        <ConvocatoriaDialog
          open={convocatoriaOpen}
          onOpenChange={setConvocatoriaOpen}
          eventoId={evento.id}
          eventoTitulo={evento.titulo}
        />
      )}
    </Dialog>
  );
}
