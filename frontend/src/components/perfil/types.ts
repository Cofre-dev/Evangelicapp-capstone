import type { SessionUser } from "@/stores/auth-store";

/**
 * Shape de la respuesta de PATCH /auth/me y PATCH /auth/me/foto: el mismo
 * objeto plano que ya devuelve GET /auth/me (usuario completo + las dos
 * banderas de onboarding), igual criterio que ya usa
 * onboarding/personal-data-modal.tsx para /onboarding/complete.
 */
export type PerfilResponse = SessionUser & {
  requiresPasswordChange: boolean;
  requiresOnboarding: boolean;
};
