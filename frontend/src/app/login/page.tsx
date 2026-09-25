"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch, setCsrfToken } from "@/lib/api";
import { useAuthStore, type SessionUser } from "@/stores/auth-store";
import logoMark from "@/img/photo/logo-mark.png";

const loginSchema = z.object({
  email: z.string().min(1, "Ingresa tu correo electrónico").email("Ingresa un correo válido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

type LoginValues = z.infer<typeof loginSchema>;

interface LoginResponse {
  usuario: SessionUser;
  requiresPasswordChange: boolean;
  requiresOnboarding: boolean;
  csrfToken: string;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const usuarioActual = useAuthStore((state) => state.usuario);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Flash tras restablecer la contraseña desde /recuperar-contrasena/<token>:
  // esa página redirige acá con ?reset=ok. El backend ya cerró las sesiones
  // del usuario, así que llega deslogueado y tiene que entrar con la nueva.
  const resetOk = searchParams.get("reset") === "ok";

  // Si ya hay una sesión guardada, /login no debe mostrar el formulario de nuevo.
  useEffect(() => {
    if (hasHydrated && usuarioActual) {
      router.replace("/");
    }
  }, [hasHydrated, usuarioActual, router]);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (hasHydrated && usuarioActual) {
    return null;
  }

  async function onSubmit(values: LoginValues) {
    setServerError(null);

    try {
      const response = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });

      setCsrfToken(response.csrfToken);
      setSession(response.usuario);
      router.push("/");
    } catch (error) {
      if (error instanceof ApiError && (error.body as { code?: string } | null)?.code === "IGLESIA_SUSPENDIDA") {
        const dias = (error.body as { diasEnMora?: number }).diasEnMora ?? 0;
        router.push(`/cuenta-suspendida?dias=${dias}`);
        return;
      }
      // Rate limit por cuenta: 3 intentos fallidos seguidos → 10 min de bloqueo
      // (a los 5 la cuenta se desactiva y vuelve como 401 genérico). El link
      // "¿Olvidaste tu contraseña?" de abajo limpia el contador si aún no llegó
      // a 5, por eso el mensaje lo menciona.
      if (error instanceof ApiError && (error.body as { code?: string } | null)?.code === "CUENTA_BLOQUEADA") {
        const min = (error.body as { minutosRestantes?: number }).minutosRestantes ?? 10;
        setServerError(
          `Demasiados intentos fallidos. Prueba de nuevo en ${min} ${min === 1 ? "minuto" : "minutos"}, o restablece tu contraseña.`,
        );
        return;
      }
      setServerError(error instanceof ApiError ? error.message : "No se pudo iniciar sesión");
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
          <h1 className="mt-6 text-lg font-medium text-foreground">Bienvenido de nuevo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ingresa con las credenciales de tu iglesia</p>
        </div>

        {resetOk && (
          <Alert className="mt-6 border-emerald-200 bg-emerald-100 text-emerald-700">
            <AlertDescription>Tu contraseña se actualizó. Inicia sesión con la nueva.</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="mt-8 space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo electrónico</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email"  {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
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

            <div className="text-right">
              <Link
                href="/recuperar-contrasena"
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar sesión"}
            </Button>
          </form>
        </Form>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          ¿No tienes una cuenta? Pídele acceso al pastor o administrador de tu iglesia.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
