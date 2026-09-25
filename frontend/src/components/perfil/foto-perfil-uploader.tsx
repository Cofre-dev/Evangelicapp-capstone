"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { Loader2, UserRound } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { PerfilResponse } from "./types";

const MIMETYPES_ACEPTADOS = ["image/png", "image/jpeg", "image/webp"];
const MAX_FOTO_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Validación client-side espejo de la que hace el backend, solo para dar
 * feedback inmediato sin esperar el round-trip — el mensaje final que se
 * muestra ante un rechazo real del servidor es siempre el que devuelve la
 * API (ver `prompt.md`: "La foto debe ser PNG, JPG o WEBP").
 */
function validarArchivo(file: File): string | null {
  if (!MIMETYPES_ACEPTADOS.includes(file.type)) {
    return "La foto debe ser PNG, JPG o WEBP";
  }
  if (file.size > MAX_FOTO_SIZE_BYTES) {
    return "La foto no puede superar 2MB";
  }
  return null;
}

export function FotoPerfilUploader() {
  const usuario = useAuthStore((state) => state.usuario);
  const updateUsuario = useAuthStore((state) => state.updateUsuario);
  const inputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file || !usuario) return;

    const validationError = validarArchivo(file);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }

    setError(null);
    setUploading(true);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const formData = new FormData();
    formData.append("foto", file);

    try {
      const response = await apiFetch<PerfilResponse>("/auth/me/foto", {
        method: "PATCH",
        body: formData,
      });
      updateUsuario(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo subir la foto");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
      event.target.value = "";
    }
  }

  const fotoActual = preview ?? usuario?.fotoUrl ?? null;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        {fotoActual ? (
          <Image
            src={fotoActual}
            alt="Tu foto de perfil"
            width={80}
            height={80}
            unoptimized={Boolean(preview)}
            className="h-20 w-20 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-primary">
            <UserRound className="h-8 w-8" />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          Cambiar foto
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleChange}
        />
        <p className="text-xs text-muted-foreground">PNG, JPG o WEBP, máximo 2MB.</p>
        {error && (
          <Alert variant="destructive" className="mt-1">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
