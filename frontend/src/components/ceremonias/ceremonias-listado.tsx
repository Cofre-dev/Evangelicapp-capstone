"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { ApiError, apiFetch } from "@/lib/api";
import type { SessionUser } from "@/stores/auth-store";
import { CeremoniaFormDialog } from "./ceremonia-form-dialog";
import { CEREMONIA_CONFIGS, nombrePrincipal, type CeremoniaTipo, type RegistroCeremonia } from "./types";

// CEREMONIAS es uno de los 4 módulos delegables (ver frontend/prompt.md): el
// MANAGER siempre tiene acceso; un USUARIO solo si el MANAGER se lo otorgó
// desde /accesos.
function tieneAccesoCeremonias(usuario: SessionUser): boolean {
  return usuario.rol === "MANAGER" || usuario.modulos.includes("CEREMONIAS");
}

interface CeremoniasListadoProps {
  tipo: CeremoniaTipo;
}

export function CeremoniasListado({ tipo }: CeremoniasListadoProps) {
  const config = CEREMONIA_CONFIGS[tipo];
  const router = useRouter();
  const { usuario, ready } = useRequireAuth();

  const [registros, setRegistros] = useState<RegistroCeremonia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<RegistroCeremonia[]>(`/ceremonias/${tipo}`);
      setRegistros(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `No se pudo cargar el registro de ${config.nombrePlural.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [usuario, tipo, config.nombrePlural]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function agregarRegistro(registro: RegistroCeremonia) {
    setRegistros((prev) => [registro, ...prev]);
  }

  if (!ready || !usuario) {
    return null;
  }

  if (!tieneAccesoCeremonias(usuario)) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">No tienes permisos para ver esta página.</p>
        <Button asChild variant="outline">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </main>
    );
  }

  const Icon = config.icon;

  function irADetalle(id: string) {
    router.push(`/ceremonias/${tipo}/${id}`);
  }

  return (
    <main className="h-full bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{config.nombrePlural}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Registro de {config.nombrePlural.toLowerCase()} de la iglesia.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo registro
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando...
            </div>
          ) : registros.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Todavía no hay registros de {config.nombrePlural.toLowerCase()}. Usa &ldquo;Nuevo registro&rdquo; para
                agregar el primero.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Folio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.map((registro) => (
                  <TableRow
                    key={registro.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver detalle de ${nombrePrincipal(config, registro) || config.nombreSingular}, folio ${registro.folio}`}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    onClick={() => irADetalle(registro.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        irADetalle(registro.id);
                      }
                    }}
                  >
                    <TableCell className="text-muted-foreground">
                      {new Date(`${String(registro.fecha).slice(0, 10)}T00:00:00`).toLocaleDateString("es-CL")}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{nombrePrincipal(config, registro)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">N.° {registro.folio}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <CeremoniaFormDialog tipo={tipo} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={agregarRegistro} />
    </main>
  );
}
