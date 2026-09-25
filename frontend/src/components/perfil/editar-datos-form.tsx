"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { PerfilResponse } from "./types";

const editarDatosSchema = z.object({
  nombre: z.string().min(1, "Ingresa tu nombre"),
  apellido: z.string().min(1, "Ingresa tu apellido"),
  telefono: z.string().optional(),
});

type EditarDatosValues = z.infer<typeof editarDatosSchema>;

export function EditarDatosForm() {
  const usuario = useAuthStore((state) => state.usuario);
  const updateUsuario = useAuthStore((state) => state.updateUsuario);

  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<EditarDatosValues>({
    resolver: zodResolver(editarDatosSchema),
    defaultValues: {
      nombre: usuario?.nombre ?? "",
      apellido: usuario?.apellido ?? "",
      telefono: usuario?.telefono ?? "",
    },
  });

  useEffect(() => {
    if (usuario) {
      form.reset({ nombre: usuario.nombre, apellido: usuario.apellido, telefono: usuario.telefono ?? "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  async function onSubmit(values: EditarDatosValues) {
    if (!usuario) return;
    setServerError(null);
    setSaved(false);

    try {
      const response = await apiFetch<PerfilResponse>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          nombre: values.nombre,
          apellido: values.apellido,
          telefono: values.telefono || undefined,
        }),
      });
      updateUsuario(response);
      setSaved(true);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudieron guardar los cambios");
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
        onChange={() => setSaved(false)}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input autoComplete="given-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="apellido"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido</FormLabel>
                <FormControl>
                  <Input autoComplete="family-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="telefono"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono (opcional)</FormLabel>
              <FormControl>
                <Input type="tel" autoComplete="tel" placeholder="+56 9 1234 5678" {...field} />
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

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
              <Check className="h-4 w-4" />
              Guardado
            </span>
          )}
        </div>
      </form>
    </Form>
  );
}
