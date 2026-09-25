"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, UserRound } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CreateUsuarioDialog } from "@/components/usuarios/create-usuario-dialog";
import {
  ROL_EQUIPO_DIRECTORIO_LABEL,
  type RolEquipoDirectorio,
  type UsuarioEquipo,
  type UsuarioEquipoDirectorio,
} from "@/components/usuarios/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { ApiError, apiFetch } from "@/lib/api";

// Mismo criterio de acceso que tenía el directorio antes del rename de roles
// (PASTOR/TESORERO/SECRETARIA podían verlo, MIEMBRO no) — ahora consolidado en
// MANAGER/USUARIO. No es un módulo delegable (no depende de `modulos`, ver
// frontend/prompt.md): cualquier USUARIO ve el directorio, la gestión
// (alta/activar/desactivar) sigue siendo exclusiva de MANAGER vía `esManager`.
const ROLES_CON_ACCESO = ["MANAGER", "USUARIO"];

/** Mismo orden que UsuariosService#findDirectorio en el backend. */
const ORDEN_ROL: Record<RolEquipoDirectorio, number> = {
  MANAGER: 0,
  USUARIO: 1,
  MIEMBRO: 2,
};

export default function EquipoPage() {
  const { usuario, ready } = useRequireAuth();
  const esManager = usuario?.rol === "MANAGER";

  const [equipo, setEquipo] = useState<UsuarioEquipoDirectorio[]>([]);
  // Solo se carga para el manager: trae `activo` y habilita activar/desactivar
  // (GET /usuarios es exclusivo de MANAGER en el backend).
  const [gestion, setGestion] = useState<Map<string, UsuarioEquipo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadEquipo = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    setError(null);

    try {
      const [directorio, gestionable] = await Promise.all([
        apiFetch<UsuarioEquipoDirectorio[]>("/usuarios/equipo"),
        usuario.rol === "MANAGER" ? apiFetch<UsuarioEquipo[]>("/usuarios") : Promise.resolve([]),
      ]);
      setEquipo(directorio);
      setGestion(new Map(gestionable.map((miembro) => [miembro.id, miembro])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el equipo");
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  useEffect(() => {
    loadEquipo();
  }, [loadEquipo]);

  async function toggleActivo(miembro: UsuarioEquipo) {
    setTogglingId(miembro.id);

    try {
      await apiFetch<UsuarioEquipo>(`/usuarios/${miembro.id}`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !miembro.activo }),
      });
      await loadEquipo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el usuario");
    } finally {
      setTogglingId(null);
    }
  }

  if (!ready || !usuario) {
    return null;
  }

  if (!ROLES_CON_ACCESO.includes(usuario.rol)) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">No tienes permisos para ver esta página.</p>
        <Button asChild variant="outline">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </main>
    );
  }

  // El directorio (`/usuarios/equipo`) solo trae usuarios activos — para cualquier
  // rol menos el manager esa es la tarjeta que corresponde mostrar. El manager necesita
  // ver también a los desactivados (si no, no hay forma de reactivarlos desde acá):
  // su propia tarjeta sale del directorio (no aparece en `/usuarios`, que lo excluye
  // a propósito) y el resto del equipo sale completo de `gestion`, activos e inactivos.
  const tarjetas: UsuarioEquipoDirectorio[] = esManager
    ? [
        ...equipo.filter((miembro) => miembro.rol === "MANAGER"),
        ...Array.from(gestion.values())
          .map((miembro) => ({
            id: miembro.id,
            nombre: miembro.nombre,
            apellido: miembro.apellido,
            fotoUrl: miembro.fotoUrl,
            rol: miembro.rol as RolEquipoDirectorio,
          }))
          .sort((a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] || a.nombre.localeCompare(b.nombre)),
      ]
    : equipo;

  return (
    <main className="h-full bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Equipo</h1>
            <p className="mt-1 text-sm text-muted-foreground">Quiénes forman parte del equipo de tu iglesia.</p>
          </div>
          {esManager && <CreateUsuarioDialog onCreated={() => loadEquipo()} />}
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando equipo...
          </div>
        ) : tarjetas.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Todavía no hay nadie en el equipo.</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tarjetas.map((miembro) => {
              // Solo existe para el manager (ver loadEquipo) y solo para el resto del
              // equipo, no para el manager mismo (GET /usuarios lo excluye a propósito).
              const gestionable = gestion.get(miembro.id);

              return (
                <div
                  key={miembro.id}
                  className={`flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm ${
                    gestionable && !gestionable.activo ? "opacity-60" : ""
                  }`}
                >
                  {miembro.fotoUrl ? (
                    <Image
                      src={miembro.fotoUrl}
                      alt={`Foto de ${miembro.nombre}`}
                      width={72}
                      height={72}
                      className="h-[72px] w-[72px] rounded-full border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent text-primary">
                      <UserRound className="h-8 w-8" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-foreground">
                      {miembro.nombre} {miembro.apellido}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-accent px-2 py-1 text-xs font-medium text-primary">
                      {ROL_EQUIPO_DIRECTORIO_LABEL[miembro.rol]}
                    </span>
                  </div>

                  {esManager && gestionable && (
                    <div className="mt-1 flex flex-col items-center gap-2">
                      <span
                        className={
                          gestionable.activo
                            ? "rounded-full bg-accent px-2 py-1 text-xs font-medium text-primary"
                            : "rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {gestionable.activo ? "Activo" : "Inactivo"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActivo(gestionable)}
                        disabled={togglingId === gestionable.id}
                      >
                        {togglingId === gestionable.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : gestionable.activo ? (
                          "Desactivar"
                        ) : (
                          "Activar"
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
