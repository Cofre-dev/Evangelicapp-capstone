"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuthStore, type SessionUser } from "@/stores/auth-store";

const onboardingSchema = z.object({
  nombre: z.string().min(1, "Ingresa tu nombre"),
  apellido: z.string().min(1, "Ingresa tu apellido"),
  telefono: z.string().optional(),
  visitantesPromedio: z.coerce
    .number({ invalid_type_error: "Ingresa un número" })
    .int("Debe ser un número entero")
    .min(0, "No puede ser negativo"),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

type OnboardingCompleteResponse = SessionUser & {
  requiresPasswordChange: boolean;
  requiresOnboarding: boolean;
};

/**
 * Segundo paso del onboarding obligatorio del dueño de cuenta (rol MANAGER,
 * antes PASTOR). Solo se muestra tras completar el cambio de contraseña
 * (mustChangePassword ya en false) y mientras onboardingCompletado siga en
 * false. El backend solo permite este paso al rol MANAGER, así que la gatilla
 * replica esa misma condición.
 */
export function PersonalDataOnboardingModal() {
  const usuario = useAuthStore((state) => state.usuario);
  const updateUsuario = useAuthStore((state) => state.updateUsuario);

  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { nombre: "", apellido: "", telefono: "", visitantesPromedio: 0 },
  });

  const shouldShow = Boolean(
    usuario && !usuario.mustChangePassword && !usuario.onboardingCompletado && usuario.rol === "MANAGER",
  );

  // Pequeño delay antes de abrir: evita que se solape con la animación de
  // salida del modal de cambio de contraseña (ambos son Dialogs separados).
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!shouldShow) {
      setOpen(false);
      return;
    }

    const timeout = setTimeout(() => setOpen(true), 220);
    return () => clearTimeout(timeout);
  }, [shouldShow]);

  useEffect(() => {
    if (open && usuario) {
      form.reset({
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        telefono: usuario.telefono ?? "",
        visitantesPromedio: 0,
      });
    }
  }, [open, usuario, form]);

  async function onSubmit(values: OnboardingValues) {
    if (!usuario) return;
    setServerError(null);

    try {
      const response = await apiFetch<OnboardingCompleteResponse>("/onboarding/complete", {
        method: "PATCH",
        body: JSON.stringify({
          nombre: values.nombre,
          apellido: values.apellido,
          telefono: values.telefono || undefined,
          visitantesPromedio: values.visitantesPromedio,
        }),
      });

      updateUsuario(response);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo guardar la información");
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary sm:mx-0">
            <UserRound className="h-6 w-6" />
          </div>
          <DialogTitle>Cuéntanos sobre ti y tu iglesia</DialogTitle>
          <DialogDescription>
            Completa estos datos para terminar de configurar tu cuenta como pastor.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
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

            <FormField
              control={form.control}
              name="visitantesPromedio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visitantes promedio por culto</FormLabel>
                  <FormControl>
                    <Input type="number" inputMode="numeric" {...field} />
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

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalizar configuración"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
