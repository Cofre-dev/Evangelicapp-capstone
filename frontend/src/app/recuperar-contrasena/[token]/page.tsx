"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch, setCsrfToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import logoMark from "@/img/photo/logo-mark.png";

// Misma política que change-password-modal.tsx (primer login): mínimo 8, al
// menos 1 letra y 1 número. El backend valida lo mismo.
const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Debe tener al menos 8 caracteres")
      .regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, "Debe incluir al menos una letra y un número"),
    confirmPassword: z.string().min(1, "Repite la contraseña"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type Values = z.infer<typeof schema>;

export default function ResetContrasenaPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [serverError, setServerError] = useState<string | null>(null);
  const [tokenInvalido, setTokenInvalido] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: Values) {
    if (!token) return;
    setServerError(null);
    setTokenInvalido(false);

    try {
      await apiFetch<{ ok: true }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: values.newPassword }),
      });
      // El backend cierra las sesiones del usuario al resetear. Si este mismo
      // navegador tenía una sesión persistida (cookies ya muertas, pero el
      // `usuario` sigue en localStorage), hay que limpiarla acá o /login lo
      // rebotaría a "/" y de ahí un 401 lo traería de vuelta sin ver el aviso.
      setCsrfToken(null);
      useAuthStore.getState().clearSession();
      router.replace("/login?reset=ok");
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setTokenInvalido(true);
        setServerError(error.message || "El enlace de recuperación no es válido o expiró.");
        return;
      }
      setServerError("No pudimos cambiar tu contraseña. Inténtalo de nuevo.");
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
          <h1 className="mt-6 text-lg font-medium text-foreground">Elige una nueva contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">Debe tener al menos 8 caracteres, con una letra y un número.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="mt-8 space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva contraseña</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className="pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar contraseña</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className="pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {serverError}
                  {tokenInvalido && (
                    <>
                      {" "}
                      <Link href="/recuperar-contrasena" className="font-medium underline">
                        Solicita uno nuevo
                      </Link>
                      .
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!form.formState.isValid || form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cambiar contraseña"}
            </Button>
          </form>
        </Form>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link href="/login" className="font-medium transition-colors hover:text-foreground">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
