"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FACTURACION_COLOR_CLASSES, PLAN_BADGE_CLASSES, PLAN_LABEL, PLAN_LIMITES } from "@/components/iglesias/types";
import type { FacturacionResponse } from "@/components/facturacion/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { ApiError, apiFetch } from "@/lib/api";

// Sin pasarela de pago: los pagos se confirman manualmente por el SuperAdmin
// (ver frontend/prompt.md) — esta pantalla es 100% informativa, sin acciones.
const CONTACTO_EMAIL = "contacto@evangelicapp.cl";

export default function FacturacionPage() {
  const { usuario, ready } = useRequireAuth();

  const [data, setData] = useState<FacturacionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<FacturacionResponse>("/mi-iglesia/facturacion");
      setData(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la facturación");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (usuario?.rol === "MANAGER") {
      cargar();
    }
  }, [usuario, cargar]);

  if (!ready || !usuario) {
    return null;
  }

  if (usuario.rol !== "MANAGER") {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">No tienes permisos para ver esta página.</p>
        <Button asChild variant="outline">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </main>
    );
  }

  const asuntoPago = data ? `Confirmación de pago — ${data.nombre}` : "";
  const asuntoUpgrade = data ? `Solicitud de upgrade de plan — ${data.nombre}` : "";

  return (
    <main className="h-full bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Facturación</h1>
          <p className="mt-1 text-sm text-muted-foreground">Plan, uso y próxima fecha de facturación de tu iglesia.</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : data ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Plan actual</CardTitle>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_BADGE_CLASSES[data.plan]}`}>
                  {PLAN_LABEL[data.plan]}
                </span>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Usuarios</p>
                  <p className="text-foreground">
                    {data.limites.usuarios.actuales} / {data.limites.usuarios.maximo}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Subdepartamentos de finanzas</p>
                  <p className="text-foreground">
                    {PLAN_LIMITES[data.plan].departamentos > 0
                      ? `${data.limites.departamentosFinancieros.actuales} / ${data.limites.departamentosFinancieros.maximo}`
                      : "Sin acceso en tu plan"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Próxima facturación</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${FACTURACION_COLOR_CLASSES[data.facturacion.color]}`}
                >
                  {new Date(data.facturacion.proximaFacturacion).toLocaleDateString("es-CL")}
                </span>
                <p className="text-sm text-muted-foreground">
                  {data.facturacion.enMora
                    ? `Vencida hace ${data.facturacion.diasEnMora} día${data.facturacion.diasEnMora === 1 ? "" : "s"}`
                    : `Faltan ${data.facturacion.diasParaFacturacion} día${data.facturacion.diasParaFacturacion === 1 ? "" : "s"}`}
                </p>
              </CardContent>
            </Card>

            {data.facturacion.enMora && (
              <Alert variant="destructive">
                <AlertDescription>Si pasas 3 días sin pagar se te podría bloquear tu cuenta.</AlertDescription>
              </Alert>
            )}

            <Card>
              <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
                <p>
                  Si ya pagaste tu mensualidad, pero te aparece que no, manda un correo a{" "}
                  <a
                    href={`mailto:${CONTACTO_EMAIL}?subject=${encodeURIComponent(asuntoPago)}`}
                    className="text-primary underline"
                  >
                    {CONTACTO_EMAIL}
                  </a>{" "}
                  con el asunto &ldquo;{asuntoPago}&rdquo;.
                </p>
                {data.plan !== "PRO" && (
                  <p>
                    Si quieres subir de plan, manda un correo a{" "}
                    <a
                      href={`mailto:${CONTACTO_EMAIL}?subject=${encodeURIComponent(asuntoUpgrade)}`}
                      className="text-primary underline"
                    >
                      {CONTACTO_EMAIL}
                    </a>{" "}
                    con el asunto &ldquo;{asuntoUpgrade}&rdquo;.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </main>
  );
}
