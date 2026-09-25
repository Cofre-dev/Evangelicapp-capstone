"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { Building2, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { MiIglesia } from "./types";

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Validación client-side espejo de la del backend. El logo ahora acepta
 * SOLO PNG (antes también JPG/WEBP) — el generador de certificados de
 * ceremonias usa una librería que solo soporta PNG/JPEG, y un logo WEBP
 * quedaba invisible en el PDF sin ningún error visible. Ver `prompt.md`.
 */
function validarArchivo(file: File): string | null {
  if (file.type !== "image/png") {
    return "El logo debe ser PNG";
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return "El logo no puede superar 2MB";
  }
  return null;
}

interface LogoIglesiaUploaderProps {
  iglesia: MiIglesia;
  onUpdated: (iglesia: MiIglesia) => void;
}

export function LogoIglesiaUploader({ iglesia, onUpdated }: LogoIglesiaUploaderProps) {
  const updateUsuario = useAuthStore((state) => state.updateUsuario);
  const usuarioActual = useAuthStore((state) => state.usuario);
  const inputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

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
    formData.append("logo", file);

    try {
      const actualizada = await apiFetch<MiIglesia>("/mi-iglesia/logo", {
        method: "PATCH",
        body: formData,
      });
      onUpdated(actualizada);
      // `plan` no lo devuelve este endpoint (no cambia acá) — se conserva el
      // que ya está en sesión, ver mismo criterio en editar-iglesia-form.tsx.
      if (usuarioActual?.iglesia) {
        updateUsuario({
          iglesia: { nombre: actualizada.nombre, logoUrl: actualizada.logoUrl, plan: usuarioActual.iglesia.plan },
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo subir el logo");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
      event.target.value = "";
    }
  }

  const logoActual = preview ?? iglesia.logoUrl ?? null;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        {logoActual ? (
          <Image
            src={logoActual}
            alt={`Logo de ${iglesia.nombre}`}
            width={80}
            height={80}
            unoptimized={Boolean(preview)}
            className="h-20 w-20 rounded-full border border-border object-contain"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-primary">
            <Building2 className="h-8 w-8" />
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
          Cambiar logo
        </Button>
        <input ref={inputRef} type="file" accept="image/png" className="hidden" onChange={handleChange} />
        <p className="text-xs text-muted-foreground">Solo PNG, máximo 2MB.</p>
        {error && (
          <Alert variant="destructive" className="mt-1">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
