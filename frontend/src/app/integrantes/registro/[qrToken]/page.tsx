"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Camera, Church, Loader2, User, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";

// Placeholder hasta que legal/producto publique la página real — configurable
// por env var para no tocar este componente cuando exista la URL definitiva.
const URL_POLITICA_PRIVACIDAD =
  process.env.NEXT_PUBLIC_URL_POLITICA_PRIVACIDAD || "/politica-privacidad";

interface IglesiaRegistro {
  nombre: string;
  logoUrl: string | null;
}

interface RegistroConfirmacion {
  nombreCompleto: string;
  fotoUrl: string | null;
  // Antes era un año calculado por el backend a partir de createdAt; ahora es
  // la fecha elegida por la persona en el formulario (string YYYY-MM-DD, tal
  // como la devuelve <input type="date">). Formato de respuesta acordado con
  // el backend en paralelo a este cambio, ver frontend/FEATURES.md.
  miembroDesde: string;
}

const FOTO_TIPOS_PERMITIDOS = ["image/png", "image/jpeg", "image/webp"];
const FOTO_MAX_BYTES = 3 * 1024 * 1024;

// RUN chileno: se usa solo para que el backend pueda deduplicar registros de
// la misma persona (más confiable que el email). Se valida formato + dígito
// verificador (algoritmo módulo 11 estándar) del lado del cliente; la
// deduplicación real la hace el backend.
function normalizarRun(run: string): string {
  return run.trim().replace(/\./g, "").toUpperCase();
}

const RUN_FORMATO = /^\d{7,8}-[0-9K]$/;

function calcularDigitoVerificador(cuerpo: string): string {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

function esRunValido(run: string): boolean {
  const normalizado = normalizarRun(run);
  if (!RUN_FORMATO.test(normalizado)) return false;
  const [cuerpo, dv] = normalizado.split("-");
  return calcularDigitoVerificador(cuerpo) === dv;
}

// Fecha (YYYY-MM-DD, la que entrega <input type="date">) comparada como
// string: para fechas ISO de igual longitud la comparación lexicográfica
// coincide con la cronológica, sin líos de zona horaria de construir un Date.
function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// El backend puede devolver la fecha como YYYY-MM-DD (sin hora) o como ISO
// completo — si no trae hora, se la agregamos a mediodía-local antes de
// pasarla a Date para que no se corra un día por zona horaria.
function formatearFecha(fecha: string): string {
  const valor = fecha.includes("T") ? fecha : `${fecha}T00:00:00`;
  return new Date(valor).toLocaleDateString("es-CL", { dateStyle: "long" });
}

const registroSchema = z.object({
  nombreCompleto: z.string().trim().min(1, "Ingresa tu nombre completo").max(150, "Máximo 150 caracteres"),
  run: z
    .string()
    .trim()
    .min(1, "Ingresa tu RUN")
    .refine(esRunValido, "Ingresa un RUN válido (ej. 12.345.678-9)"),
  email: z.string().trim().min(1, "Ingresa tu correo").email("Ingresa un correo válido"),
  telefono: z.string().trim().min(1, "Ingresa tu teléfono").max(30, "Máximo 30 caracteres"),
  miembroDesde: z
    .string()
    .min(1, "Selecciona la fecha")
    .refine((value) => value <= hoyISO(), "La fecha no puede ser futura"),
  foto: z
    .instanceof(File)
    .optional()
    .refine((file) => !file || FOTO_TIPOS_PERMITIDOS.includes(file.type), "La foto debe ser PNG, JPG o WEBP")
    .refine((file) => !file || file.size <= FOTO_MAX_BYTES, "La foto no puede pesar más de 3MB"),
  // Solo gatea el envío en el cliente (Ley 21.719): el backend todavía no
  // tiene dónde guardar el consentimiento, así que este campo nunca se manda
  // en el body del POST — ver frontend/prompt.md.
  aceptaPolitica: z.boolean().refine((value) => value === true, "Debes aceptar el tratamiento de tus datos"),
});

type RegistroValues = z.infer<typeof registroSchema>;

type Pantalla = "cargando" | "invalido" | "formulario" | "confirmacion";

export default function RegistroIntegrantePage() {
  const params = useParams<{ qrToken: string }>();

  const [pantalla, setPantalla] = useState<Pantalla>("cargando");
  const [mensajeInvalido, setMensajeInvalido] = useState("Este código QR no es válido.");
  const [iglesia, setIglesia] = useState<IglesiaRegistro | null>(null);
  const [confirmacion, setConfirmacion] = useState<RegistroConfirmacion | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fotoInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<RegistroValues>({
    resolver: zodResolver(registroSchema),
    defaultValues: {
      nombreCompleto: "",
      run: "",
      email: "",
      telefono: "",
      miembroDesde: "",
      foto: undefined,
      aceptaPolitica: false,
    },
  });

  useEffect(() => {
    if (!params.qrToken) return;

    apiFetch<IglesiaRegistro>(`/integrantes/registro/${params.qrToken}`)
      .then((data) => {
        setIglesia(data);
        setPantalla("formulario");
      })
      .catch((err) => {
        setMensajeInvalido(err instanceof ApiError ? err.message : "Este código QR no es válido.");
        setPantalla("invalido");
      });
  }, [params.qrToken]);

  // Los object URLs de la preview de foto solo viven en memoria del navegador
  // — hay que liberarlos al reemplazar la foto o desmontar, si no se filtran.
  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function elegirFoto(file: File | undefined, onChange: (file: File | undefined) => void) {
    onChange(file);
    setFotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  function quitarFoto(onChange: (file: File | undefined) => void) {
    onChange(undefined);
    setFotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  }

  async function onSubmit(values: RegistroValues) {
    if (!params.qrToken) return;
    setServerError(null);

    const formData = new FormData();
    formData.append("nombreCompleto", values.nombreCompleto);
    formData.append("run", normalizarRun(values.run));
    formData.append("email", values.email);
    formData.append("telefono", values.telefono);
    formData.append("miembroDesde", values.miembroDesde);
    if (values.foto) formData.append("foto", values.foto);

    try {
      const respuesta = await apiFetch<RegistroConfirmacion>(`/integrantes/registro/${params.qrToken}`, {
        method: "POST",
        body: formData,
      });
      setConfirmacion(respuesta);
      setPantalla("confirmacion");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setMensajeInvalido("Este código ya no está activo, pide uno nuevo.");
        setPantalla("invalido");
        return;
      }
      setServerError(err instanceof ApiError ? err.message : "No se pudo enviar el formulario");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Franja de marca: identifica la app antes de pedirle datos personales a alguien
            que llega sin ningún contexto (escaneó un QR en papel). Presente en todos los
            estados para que la pantalla nunca cambie de "identidad" a mitad del flujo. */}
        <div aria-hidden className="h-1.5 bg-[linear-gradient(90deg,hsl(199_70%_52%),hsl(203_66%_42%))]" />
        <div className="p-8">
          <div className="mb-6 flex items-center justify-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Church className="h-3.5 w-3.5" />
            </div>
            <p className="font-display text-base italic text-primary">Evangelicapp</p>
          </div>

          {pantalla === "cargando" && (
            <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando...
            </div>
          )}

          {pantalla === "invalido" && (
            <Alert variant="destructive">
              <AlertDescription>{mensajeInvalido}</AlertDescription>
            </Alert>
          )}

          {pantalla === "confirmacion" && confirmacion && (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              {confirmacion.fotoUrl ? (
                <Image
                  src={confirmacion.fotoUrl}
                  alt={confirmacion.nombreCompleto}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-primary">
                  <User className="h-9 w-9" />
                </div>
              )}
              <h1 className="font-display text-2xl italic text-primary">¡Gracias, {confirmacion.nombreCompleto}!</h1>
              <p className="text-sm text-muted-foreground">
                Miembro desde {formatearFecha(confirmacion.miembroDesde)}
              </p>
            </div>
          )}

          {pantalla === "formulario" && iglesia && (
            <>
              <div className="flex flex-col items-center gap-2 text-center">
                {iglesia.logoUrl ? (
                  <Image
                    src={iglesia.logoUrl}
                    alt={`Logo de ${iglesia.nombre}`}
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-full border border-border object-contain"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
                    <Building2 className="h-6 w-6" />
                  </div>
                )}
                <p className="text-sm font-medium text-foreground">{iglesia.nombre}</p>
                <p className="text-xs text-muted-foreground">Regístrate como integrante de la congregación</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
                  <FormField
                    control={form.control}
                    name="nombreCompleto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre completo</FormLabel>
                        <FormControl>
                          <Input autoComplete="name" placeholder="María Pérez" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="run"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RUN</FormLabel>
                        <FormControl>
                          <Input autoComplete="off" placeholder="12.345.678-9" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo electrónico</FormLabel>
                        <FormControl>
                          <Input type="email" autoComplete="email" placeholder="maria@correo.cl" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telefono"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input type="tel" autoComplete="tel" placeholder="+56 9 1234 5678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="miembroDesde"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Miembro desde</FormLabel>
                        <FormControl>
                          <Input type="date" max={hoyISO()} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="foto"
                    render={({ field: { onChange, value, ref, ...field } }) => (
                      <FormItem>
                        <FormLabel>Foto (opcional)</FormLabel>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => fotoInputRef.current?.click()}
                            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-input bg-muted text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            aria-label={fotoPreview ? "Cambiar foto" : "Agregar foto"}
                          >
                            {fotoPreview ? (
                              // eslint-disable-next-line @next/next/no-img-element -- object URL local en memoria, next/image no aplica
                              <img src={fotoPreview} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Camera className="h-6 w-6" />
                            )}
                          </button>
                          <div className="flex flex-col items-start gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fotoInputRef.current?.click()}
                            >
                              {fotoPreview ? "Cambiar foto" : "Elegir foto"}
                            </Button>
                            {fotoPreview && (
                              <button
                                type="button"
                                onClick={() => quitarFoto(onChange)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                                Quitar foto
                              </button>
                            )}
                          </div>
                          <FormControl>
                            <input
                              {...field}
                              ref={(el) => {
                                ref(el);
                                fotoInputRef.current = el;
                              }}
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="sr-only"
                              onChange={(e) => elegirFoto(e.target.files?.[0], onChange)}
                            />
                          </FormControl>
                        </div>
                        <p className="text-xs text-muted-foreground">PNG, JPG o WEBP, máximo 3MB.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="aceptaPolitica"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-start gap-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-0.5"
                            />
                          </FormControl>
                          <FormLabel className="text-xs font-normal leading-snug text-muted-foreground">
                            He leído y acepto el{" "}
                            <a
                              href={URL_POLITICA_PRIVACIDAD}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline underline-offset-2 hover:no-underline"
                            >
                              tratamiento de mis datos personales
                            </a>
                          </FormLabel>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {serverError && (
                    <Alert variant="destructive">
                      <AlertDescription>{serverError}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={form.formState.isSubmitting || !form.watch("aceptaPolitica")}
                  >
                    {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrarme"}
                  </Button>
                </form>
              </Form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
