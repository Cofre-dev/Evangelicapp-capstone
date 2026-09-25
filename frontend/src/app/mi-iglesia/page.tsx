"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditarIglesiaForm } from "@/components/mi-iglesia/editar-iglesia-form";
import { LogoIglesiaUploader } from "@/components/mi-iglesia/logo-iglesia-uploader";
import type { MiIglesia } from "@/components/mi-iglesia/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { ApiError, apiFetch } from "@/lib/api";

const ESTADO_LABEL: Record<MiIglesia["estado"], string> = {
  ACTIVA: "Activa",
  SUSPENDIDA: "Suspendida",
  INACTIVA: "Inactiva",
};

export default function MiIglesiaPage() {
  const { usuario, ready } = useRequireAuth();

  const [iglesia, setIglesia] = useState<MiIglesia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarIglesia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<MiIglesia>("/mi-iglesia");
      setIglesia(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la iglesia");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (usuario?.rol === "MANAGER") {
      cargarIglesia();
    }
  }, [usuario, cargarIglesia]);

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

  return (
    <main className="h-full bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Mi iglesia</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Corrige los datos ingresados al momento del alta de tu iglesia.
          </p>
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
        ) : iglesia ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Logo</CardTitle>
                <span
                  className={
                    iglesia.estado === "ACTIVA"
                      ? "rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary"
                      : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {ESTADO_LABEL[iglesia.estado]}
                </span>
              </CardHeader>
              <CardContent>
                <LogoIglesiaUploader iglesia={iglesia} onUpdated={setIglesia} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos de la iglesia</CardTitle>
              </CardHeader>
              <CardContent>
                <EditarIglesiaForm iglesia={iglesia} onUpdated={setIglesia} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </main>
  );
}
