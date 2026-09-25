export interface Integrante {
  id: string;
  nombreCompleto: string;
  run: string;
  email: string;
  telefono: string;
  fotoUrl: string | null;
  // Fecha elegida por la persona al registrarse (YYYY-MM-DD o ISO completo,
  // según lo que confirme el backend) — ya no se deriva de createdAt.
  miembroDesde: string;
  createdAt: string;
  updatedAt: string;
  iglesiaId: string;
}

export interface QrInfo {
  qrToken: string;
  urlRegistro: string;
}

/**
 * Payload del evento de socket `integrante:registrado` (Realtime, ver
 * frontend/prompt.md) — se dispara cuando alguien completa el formulario
 * público del QR y es un integrante NUEVO (si ya existía por email/RUN, no
 * se emite nada, no hay "fila nueva" que mostrar).
 */
export interface IntegranteRegistradoPayload {
  id: string;
  nombreCompleto: string;
  fotoUrl: string | null;
  miembroDesde: string;
}
