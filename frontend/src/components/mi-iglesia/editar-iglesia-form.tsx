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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, apiFetch } from "@/lib/api";
import { REGIONES_CHILE } from "@/lib/chile-regiones";
import { useAuthStore } from "@/stores/auth-store";
import type { MiIglesia } from "./types";

const editarIglesiaSchema = z.object({
  nombre: z.string().min(1, "Ingresa el nombre"),
  region: z.string().min(1, "Selecciona una región"),
  comuna: z.string().min(1, "Selecciona una comuna"),
  direccion: z.string().optional(),
});

type EditarIglesiaValues = z.infer<typeof editarIglesiaSchema>;

interface EditarIglesiaFormProps {
  iglesia: MiIglesia;
  onUpdated: (iglesia: MiIglesia) => void;
}

export function EditarIglesiaForm({ iglesia, onUpdated }: EditarIglesiaFormProps) {
  const updateUsuario = useAuthStore((state) => state.updateUsuario);
  const usuarioActual = useAuthStore((state) => state.usuario);

  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<EditarIglesiaValues>({
    resolver: zodResolver(editarIglesiaSchema),
    defaultValues: {
      nombre: iglesia.nombre,
      region: iglesia.region,
      comuna: iglesia.comuna,
      direccion: iglesia.direccion ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      nombre: iglesia.nombre,
      region: iglesia.region,
      comuna: iglesia.comuna,
      direccion: iglesia.direccion ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iglesia.id]);

  const regionSeleccionada = form.watch("region");
  const comunasDisponibles = REGIONES_CHILE.find((r) => r.region === regionSeleccionada)?.comunas ?? [];

  async function onSubmit(values: EditarIglesiaValues) {
    setServerError(null);
    setSaved(false);

    try {
      const actualizada = await apiFetch<MiIglesia>("/mi-iglesia", {
        method: "PATCH",
        body: JSON.stringify({
          nombre: values.nombre,
          region: values.region,
          comuna: values.comuna,
          direccion: values.direccion || undefined,
        }),
      });
      onUpdated(actualizada);
      // El navbar/home muestran usuario.iglesia.{nombre,logoUrl,plan} desde la
      // sesión persistida — sin esto, un cambio de nombre acá no se vería
      // reflejado ahí hasta el próximo login. `plan` no lo devuelve este
      // endpoint (no cambia acá), así que se conserva el que ya está en sesión.
      if (usuarioActual?.iglesia) {
        updateUsuario({
          iglesia: { nombre: actualizada.nombre, logoUrl: actualizada.logoUrl, plan: usuarioActual.iglesia.plan },
        });
      }
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
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la iglesia</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="region"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Región</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue("comuna", "");
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {REGIONES_CHILE.map((r) => (
                      <SelectItem key={r.region} value={r.region}>
                        {r.region}
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
            name="comuna"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Comuna</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!regionSeleccionada}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={regionSeleccionada ? "Selecciona" : "Elige región primero"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {comunasDisponibles.map((comuna) => (
                      <SelectItem key={comuna} value={comuna}>
                        {comuna}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="direccion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección (opcional)</FormLabel>
              <FormControl>
                <Input {...field} />
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
