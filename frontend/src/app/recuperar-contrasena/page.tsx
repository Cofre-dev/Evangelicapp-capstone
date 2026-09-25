"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";
import logoMark from "@/img/photo/logo-mark.png";

const schema = z.object({
  email: z.string().min(1, "Ingresa tu correo electrónico").email("Ingresa un correo válido"),
});

type Values = z.infer<typeof schema>;

// El backend siempre responde 200 (anti-enumeración), exista o no el correo.
// El frontend nunca distingue casos: mismo mensaje neutro para todos.
const MENSAJE_NEUTRO =
  "Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada y la carpeta de spam.";

export default function RecuperarContrasenaPage() {
  const [enviado, setEnviado] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: Values) {
    setServerError(null);

    try {
      await apiFetch<{ ok: true }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: values.email }),
      });
      setEnviado(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setServerError("Hiciste varios intentos seguidos. Espera unos minutos y vuelve a probar.");
        return;
      }
      setServerError("No pudimos procesar la solicitud. Inténtalo de nuevo.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="relative w-full max-w-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-40 w-40 -translate-x-1/2 -translate-y-6 rounded-full bg-primary/20 blur-3xl"
        />

        <div className="flex flex-col items-center text-center">
          <Image src={logoMark} alt="" priority className="h-16 w-16" />
          <p className="mt-4 font-display text-2xl italic text-primary">Evangelicapp</p>
          <h1 className="mt-6 text-lg font-medium text-foreground">Recupera tu contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Te enviaremos un enlace para restablecerla al correo de tu cuenta.
          </p>
        </div>

        {enviado ? (
          <div className="mt-8 flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
              <MailCheck className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">{MENSAJE_NEUTRO}</p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="mt-8 space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo electrónico</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
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
                {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar enlace"}
              </Button>
            </form>
          </Form>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link href="/login" className="font-medium transition-colors hover:text-foreground">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
