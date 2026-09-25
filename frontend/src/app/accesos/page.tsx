"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, UserRound } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ModuloCatalogo, UsuarioAccesos } from "@/components/accesos/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { ApiError, apiFetch } from "@/lib/api";

interface Fila {
  usuario: UsuarioAccesos;
  /** Selección actual de checkboxes — puede diferir de `usuario.modulos` mientras
   * hay cambios sin guardar en esta fila. */
  seleccion: string[];
}

function mismoConjunto(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((m) => setB.has(m));
}

export default function AccesosPage() {
  const { usuario, ready } = useRequireAuth();

  const [catalogo, setCatalogo] = useState<ModuloCatalogo[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!usuario || usuario.rol !== "MANAGER") return;
    setLoading(true);
    setError(null);

    try {
      const [catalogoData, usuariosData] = await Promise.all([
        apiFetch<ModuloCatalogo[]>("/accesos/catalogo"),
        apiFetch<UsuarioAccesos[]>("/accesos/usuarios"),
      ]);
      setCatalogo(catalogoData);
      setFilas(usuariosData.map((u) => ({ usuario: u, seleccion: u.modulos })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los accesos");
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function toggleModulo(usuarioId: string, moduloId: string, marcado: boolean) {
    setFilas((prev) =>
      prev.map((fila) =>
        fila.usuario.id === usuarioId
          ? {
              ...fila,
              seleccion: marcado
                ? [...fila.seleccion, moduloId]
                : fila.seleccion.filter((m) => m !== moduloId),
            }
          : fila,
      ),
    );
  }

  async function guardarFila(fila: Fila) {
    setGuardandoId(fila.usuario.id);
    setError(null);

    try {
      // El PUT reemplaza el set completo de módulos (no es un diff) — ver
      // frontend/prompt.md. No se asume una forma particular de la respuesta
      // (el brief no la especifica): tras el 2xx, se sincroniza el estado
      // local con lo que se acaba de mandar.
      await apiFetch(`/accesos/usuarios/${fila.usuario.id}`, {
        method: "PUT",
        body: JSON.stringify({ modulos: fila.seleccion }),
      });
      setFilas((prev) =>
        prev.map((f) =>
          f.usuario.id === fila.usuario.id
            ? { usuario: { ...f.usuario, modulos: fila.seleccion }, seleccion: fila.seleccion }
            : f,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron guardar los accesos");
    } finally {
      setGuardandoId(null);
    }
  }

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
      <div className="mx-auto max-w-4xl">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Accesos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Otorga o quita el acceso de cada usuario a los módulos del sistema. Los cambios pueden tardar hasta 15
            minutos en aplicarse en la API si la persona ya tiene una sesión abierta.
          </p>
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
          ) : catalogo.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Todavía no hay módulos configurados en el sistema.
            </p>
          ) : filas.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Todavía no hay usuarios a quienes otorgar accesos.{" "}
              <Link href="/equipo" className="underline">
                Crea uno desde Equipo
              </Link>
              .
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    {catalogo.map((modulo) => (
                      <TableHead key={modulo.id} className="text-center">
                        {modulo.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((fila) => {
                    const dirty = !mismoConjunto(fila.seleccion, fila.usuario.modulos);
                    return (
                      <TableRow key={fila.usuario.id} className={fila.usuario.activo ? undefined : "opacity-60"}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {fila.usuario.fotoUrl ? (
                              <Image
                                src={fila.usuario.fotoUrl}
                                alt={`Foto de ${fila.usuario.nombre}`}
                                width={36}
                                height={36}
                                className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                                <UserRound className="h-4 w-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {fila.usuario.nombre} {fila.usuario.apellido}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                @{fila.usuario.username}
                                {!fila.usuario.activo && " · Inactivo"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        {catalogo.map((modulo) => (
                          <TableCell key={modulo.id} className="text-center">
                            <input
                              type="checkbox"
                              checked={fila.seleccion.includes(modulo.id)}
                              onChange={(e) => toggleModulo(fila.usuario.id, modulo.id, e.target.checked)}
                              aria-label={`${modulo.label} para ${fila.usuario.nombre} ${fila.usuario.apellido}`}
                              className="h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!dirty || guardandoId === fila.usuario.id}
                            onClick={() => guardarFila(fila)}
                          >
                            {guardandoId === fila.usuario.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Guardar"
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
