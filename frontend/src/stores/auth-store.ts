import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlanIglesia } from "@/components/iglesias/types";

export type Rol = "SUPER_ADMIN" | "MANAGER" | "USUARIO" | "MIEMBRO";

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  fotoUrl: string | null;
  rol: Rol;
  iglesiaId: string | null;
  iglesia: { nombre: string; logoUrl: string | null; plan: PlanIglesia } | null;
  mustChangePassword: boolean;
  onboardingCompletado: boolean;
  /** Módulos delegables (`AGENDA`/`FINANZAS`/`CEREMONIAS`/`INTEGRANTES`, catálogo
   * abierto vía `GET /accesos/catalogo`) que el MANAGER le otorgó a este USUARIO.
   * Siempre `[]` para SUPER_ADMIN/MANAGER/MIEMBRO — su acceso no depende de esta
   * lista (ver frontend/prompt.md). No hardcodear los ids acá: solo se usa para
   * `.includes()` contra lo que el backend haya asignado. */
  modulos: string[];
}

interface AuthState {
  usuario: SessionUser | null;
  /** Zustand persist rehidrata desde localStorage de forma asíncrona — sin esto,
   * una página protegida redirigiría a /login por una fracción de segundo aunque
   * sí haya sesión guardada. */
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  setSession: (usuario: SessionUser) => void;
  updateUsuario: (patch: Partial<SessionUser>) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      // El backend puede no mandar `modulos` en algunas respuestas (ver
      // frontend/prompt.md, pendiente de confirmar para /auth/login) — se
      // normaliza acá, único punto de entrada de una sesión nueva completa,
      // para que el resto del código pueda asumir siempre un array.
      setSession: (usuario) =>
        set({ usuario: { ...usuario, modulos: Array.isArray(usuario.modulos) ? usuario.modulos : [] } }),
      updateUsuario: (patch) =>
        set((state) => (state.usuario ? { usuario: { ...state.usuario, ...patch } } : state)),
      clearSession: () => set({ usuario: null }),
    }),
    {
      name: "evangelicapp-auth",
      // v2: `iglesia` gana `plan` (ver frontend/prompt.md, planes comerciales).
      // Mismo criterio que la migración v1 (`modulos`): una sesión persistida
      // antes de este cambio no tiene forma de conseguir su `plan` sin volver a
      // loguearse, así que se descarta en vez de dejar `plan` undefined en runtime.
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as Partial<AuthState> | undefined;
        if (!state?.usuario || !Array.isArray(state.usuario.modulos)) {
          return { ...state, usuario: null };
        }
        if (state.usuario.iglesia && !("plan" in state.usuario.iglesia)) {
          return { ...state, usuario: null };
        }
        return state;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
