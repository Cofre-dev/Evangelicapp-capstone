"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuthStore, type SessionUser } from "@/stores/auth-store";
import { CEREMONIA_CONFIGS, type CeremoniaTipo, type ConfigCeremonia, type RegistroCeremonia } from "./types";

type FormValues = Record<string, string>;

function toDateInputValue(value: string): string {
  // El backend puede devolver `YYYY-MM-DD` o un ISO completo con hora — nos quedamos
  // solo con la parte de fecha, que es lo que acepta <input type="date">.
  return value.slice(0, 10);
}

function valoresPorDefecto(
  config: ConfigCeremonia,
  registro: RegistroCeremonia | null | undefined,
  usuario: SessionUser | null,
): FormValues {
  const values: FormValues = {
    fecha: registro ? toDateInputValue(registro.fecha) : "",
  };

  for (const campo of config.campos) {
    if (registro) {
      values[campo.name] = String(registro[campo.name] ?? "");
      continue;
    }
    // Solo se prellena cuando quien crea el registro es el propio MANAGER de la
    // sesión — si es un USUARIO no hay dato del lado del cliente para saber quién
    // es el pastor de la iglesia (ver nota en `types.ts`), se deja en blanco.
    values[campo.name] = campo.prellenarPastor && usuario?.rol === "MANAGER" ? `${usuario.nombre} ${usuario.apellido}` : "";
  }

  return values;
}

interface CeremoniaFormDialogProps {
  tipo: CeremoniaTipo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Registro a editar. `null`/`undefined` abre el diálogo en modo creación. */
  registro?: RegistroCeremonia | null;
  onSaved: (registro: RegistroCeremonia) => void;
}

export function CeremoniaFormDialog({ tipo, open, onOpenChange, registro, onSaved }: CeremoniaFormDialogProps) {
  const config = CEREMONIA_CONFIGS[tipo];
  const usuario = useAuthStore((state) => state.usuario);
  const esEdicion = Boolean(registro);
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = useMemo(() => {
    const shape: Record<string, z.ZodString> = {
      fecha: z.string().min(1, "Selecciona una fecha"),
    };
    for (const campo of config.campos) {
      shape[campo.name] = z
        .string()
        .min(1, `${campo.label} es obligatorio`)
        .max(campo.maxLength, `Máximo ${campo.maxLength} caracteres`);
    }
    return z.object(shape);
  }, [config]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresPorDefecto(config, null, usuario),
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    form.reset(valoresPorDefecto(config, registro, usuario));
    // `usuario`/`config` a propósito no son dependencias completas: solo nos interesa
    // tomar el snapshot al abrir el diálogo, no resetear el formulario mientras se edita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, registro, tipo]);

  async function onSubmit(values: FormValues) {
    setServerError(null);

    try {
      const body: Record<string, string> = { fecha: values.fecha };
      for (const campo of config.campos) {
        body[campo.name] = values[campo.name].trim();
      }

      const guardado = await apiFetch<RegistroCeremonia>(
        esEdicion ? `/ceremonias/${tipo}/${registro!.id}` : `/ceremonias/${tipo}`,
        { method: esEdicion ? "PATCH" : "POST", body: JSON.stringify(body) },
      );

      onOpenChange(false);
      onSaved(guardado);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo guardar el registro");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{esEdicion ? `Editar ${config.nombreSingular.toLowerCase()}` : `Nuevo registro`}</DialogTitle>
          <DialogDescription>
            {esEdicion
              ? `Actualiza los datos de este registro de ${config.nombreSingular.toLowerCase()}.`
              : `Completa los datos para registrar un(a) nuevo(a) ${config.nombreSingular.toLowerCase()}.`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
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

            {config.campos.map((campo) => (
              <FormField
                key={campo.name}
                control={form.control}
                name={campo.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{campo.label}</FormLabel>
                    <FormControl>
                      <Input placeholder={campo.placeholder} maxLength={campo.maxLength} {...field} />
                    </FormControl>
                    {campo.prellenarPastor && !esEdicion && (
                      <FormDescription>
                        {usuario?.rol === "MANAGER"
                          ? "Se completó con tu nombre — puedes cambiarlo si ofició otro pastor."
                          : "Ingresa el nombre completo de quien ofició la ceremonia."}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : esEdicion ? (
                  "Guardar cambios"
                ) : (
                  "Crear registro"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
