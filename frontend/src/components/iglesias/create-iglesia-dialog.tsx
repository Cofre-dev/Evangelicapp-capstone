"use client";

import { useState, type ChangeEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Copy, Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, apiFetch } from "@/lib/api";
import { REGIONES_CHILE } from "@/lib/chile-regiones";
import { PLAN_LABEL, PLAN_LIMITES } from "@/components/iglesias/types";
import { useAuthStore } from "@/stores/auth-store";

const USERNAME_REGEX = /^[a-z][a-z0-9._]{3,19}$/;
const PLANES = ["BASICO", "MEDIO", "PRO"] as const;

const createIglesiaSchema = z.object({
  nombre: z.string().min(1, "Ingresa el nombre"),
  region: z.string().min(1, "Selecciona una región"),
  comuna: z.string().min(1, "Selecciona una comuna"),
  direccion: z.string().optional(),
  plan: z.enum(PLANES, { errorMap: () => ({ message: "Selecciona un plan" }) }),
  fechaAdquisicionPlan: z.string().min(1, "Selecciona la fecha de adquisición del plan"),
  pastorUsername: z
    .string()
    .min(1, "Ingresa un usuario")
    .regex(USERNAME_REGEX, "4-20 caracteres, minúsculas, empieza con letra"),
  pastorEmail: z.string().min(1, "Ingresa un correo").email("Correo inválido"),
  pastorNombre: z.string().min(1, "Ingresa el nombre"),
  pastorApellido: z.string().min(1, "Ingresa el apellido"),
});

type CreateIglesiaValues = z.infer<typeof createIglesiaSchema>;

/** Campos que se validan antes de dejar avanzar del paso 1 (iglesia) al paso 2 (pastor). */
const CAMPOS_PASO_IGLESIA = ["nombre", "region", "comuna", "plan", "fechaAdquisicionPlan"] as const;

interface IglesiaCreada {
  id: string;
  nombre: string;
  comuna: string;
  region: string;
  direccion: string | null;
  logoUrl: string | null;
  estado: "ACTIVA" | "SUSPENDIDA" | "INACTIVA";
  createdAt: string;
}

interface CreateIglesiaResponse {
  iglesia: IglesiaCreada;
  pastor: { id: string; username: string; email: string; nombre: string; apellido: string };
  temporaryPassword: string;
}

type Step = "iglesia" | "pastor" | "result";

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

/** El backend calcula la primera facturación como fechaAdquisicionPlan + 30
 * días (ver frontend/prompt.md) — se replica acá solo para la preview en el
 * formulario, el valor real siempre lo define el backend. */
function calcularProximaFacturacion(fechaAdquisicionPlan: string): string | null {
  const [year, month, day] = fechaAdquisicionPlan.split("-").map(Number);
  if (!year || !month || !day) return null;

  const fecha = new Date(year, month - 1, day);
  fecha.setDate(fecha.getDate() + 30);
  return fecha.toLocaleDateString("es-CL");
}

export function CreateIglesiaDialog({ onCreated }: { onCreated: () => void }) {
  const usuario = useAuthStore((state) => state.usuario);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("iglesia");
  const [serverError, setServerError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateIglesiaResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<CreateIglesiaValues>({
    resolver: zodResolver(createIglesiaSchema),
    defaultValues: {
      nombre: "",
      region: "",
      comuna: "",
      direccion: "",
      plan: "BASICO",
      fechaAdquisicionPlan: "",
      pastorUsername: "",
      pastorEmail: "",
      pastorNombre: "",
      pastorApellido: "",
    },
  });

  const regionSeleccionada = form.watch("region");
  const comunasDisponibles = REGIONES_CHILE.find((r) => r.region === regionSeleccionada)?.comunas ?? [];
  const fechaAdquisicionPlan = form.watch("fechaAdquisicionPlan");
  const proximaFacturacionPreview = fechaAdquisicionPlan ? calcularProximaFacturacion(fechaAdquisicionPlan) : null;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      form.reset();
      setStep("iglesia");
      setServerError(null);
      setLogoFile(null);
      setLogoError(null);
      setResult(null);
      setCopied(false);
    }
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setLogoError(null);

    if (file && file.type !== "image/png") {
      setLogoError("El logo debe ser PNG");
      event.target.value = "";
      setLogoFile(null);
      return;
    }

    if (file && file.size > MAX_LOGO_SIZE_BYTES) {
      setLogoError("El logo no puede superar 2MB");
      event.target.value = "";
      setLogoFile(null);
      return;
    }

    setLogoFile(file);
  }

  async function handleSiguiente() {
    const valido = await form.trigger(CAMPOS_PASO_IGLESIA);
    if (valido) setStep("pastor");
  }

  async function onSubmit(values: CreateIglesiaValues) {
    if (!usuario) return;
    setServerError(null);

    const formData = new FormData();
    formData.append("nombre", values.nombre);
    formData.append("region", values.region);
    formData.append("comuna", values.comuna);
    if (values.direccion) formData.append("direccion", values.direccion);
    formData.append("plan", values.plan);
    formData.append("fechaAdquisicionPlan", values.fechaAdquisicionPlan);
    formData.append("pastorUsername", values.pastorUsername);
    formData.append("pastorEmail", values.pastorEmail);
    formData.append("pastorNombre", values.pastorNombre);
    formData.append("pastorApellido", values.pastorApellido);
    if (logoFile) formData.append("logo", logoFile);

    try {
      const response = await apiFetch<CreateIglesiaResponse>("/iglesias", {
        method: "POST",
        body: formData,
      });

      setResult(response);
      setStep("result");
      onCreated();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo crear la iglesia");
    }
  }

  async function copyPassword() {
    if (!result) return;
    await navigator.clipboard.writeText(result.temporaryPassword);
    setCopied(true);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Nueva iglesia
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === "result" && result ? (
          <>
            <DialogHeader>
              <DialogTitle>Iglesia creada</DialogTitle>
              <DialogDescription>
                Comparte estas credenciales con {result.pastor.nombre} — la contraseña no se volverá a mostrar. Se le
                pedirá cambiarla en su primer inicio de sesión.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <div className="rounded-lg border border-border bg-muted px-4 py-3">
                <p className="text-xs text-muted-foreground">Usuario</p>
                <code className="text-sm font-medium text-foreground">{result.pastor.username}</code>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">Contraseña temporal</p>
                  <code className="text-sm font-medium text-foreground">{result.temporaryPassword}</code>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={copyPassword}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button className="w-full" onClick={() => handleOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nueva iglesia</DialogTitle>
              <DialogDescription>
                {step === "iglesia"
                  ? "Paso 1 de 2 — datos de la iglesia."
                  : "Paso 2 de 2 — el pastor a cargo se crea con credenciales temporales."}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
                {step === "iglesia" && (
                  <>
                    <FormField
                      control={form.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de la iglesia</FormLabel>
                          <FormControl>
                            <Input placeholder="Iglesia Evangélica..." {...field} />
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
                                  <SelectValue
                                    placeholder={regionSeleccionada ? "Selecciona" : "Elige región primero"}
                                  />
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

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="plan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plan</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PLANES.map((plan) => (
                                  <SelectItem key={plan} value={plan}>
                                    {PLAN_LABEL[plan]} — hasta {PLAN_LIMITES[plan].usuarios} usuarios
                                    {PLAN_LIMITES[plan].departamentos > 0
                                      ? `, ${PLAN_LIMITES[plan].departamentos} subdepartamentos`
                                      : ""}
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
                        name="fechaAdquisicionPlan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha de adquisición del plan</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            {proximaFacturacionPreview && (
                              <p className="text-xs text-muted-foreground">
                                Próxima facturación: {proximaFacturacionPreview}
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="logo">Logo (opcional)</Label>
                      <Input id="logo" type="file" accept="image/png" onChange={handleLogoChange} />
                      <p className="text-xs text-muted-foreground">
                        Solo PNG, máximo 2MB. El pastor y su equipo lo verán en su pantalla principal junto al
                        nombre de la iglesia.
                      </p>
                      {logoError && <p className="text-sm font-medium text-destructive">{logoError}</p>}
                    </div>

                    <Button type="button" className="w-full" onClick={handleSiguiente}>
                      Siguiente
                    </Button>
                  </>
                )}

                {step === "pastor" && (
                  <>
                    <FormField
                      control={form.control}
                      name="pastorUsername"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usuario</FormLabel>
                          <FormControl>
                            <Input autoComplete="off" placeholder="jperez" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pastorEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Correo electrónico</FormLabel>
                          <FormControl>
                            <Input type="email" autoComplete="email" placeholder="pastor@iglesia.cl" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="pastorNombre"
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
                        name="pastorApellido"
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

                    {serverError && (
                      <Alert variant="destructive">
                        <AlertDescription>{serverError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setStep("iglesia")}>
                        <ArrowLeft className="h-4 w-4" />
                        Atrás
                      </Button>
                      <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear iglesia"}
                      </Button>
                    </div>
                  </>
                )}
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
