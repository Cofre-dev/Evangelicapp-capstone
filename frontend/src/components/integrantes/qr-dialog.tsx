"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { AlertTriangle, Check, Copy, Download, Loader2, QrCode, RefreshCw, User, Users } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRealtimeEvent } from "@/hooks/use-realtime";
import { ApiError, apiFetch } from "@/lib/api";
import type { IntegranteRegistradoPayload, QrInfo } from "./types";

export function QrDialog() {
  const [open, setOpen] = useState(false);
  const [qrInfo, setQrInfo] = useState<QrInfo | null>(null);
  const [qrImagen, setQrImagen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [confirmandoRegenerar, setConfirmandoRegenerar] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [recienCensados, setRecienCensados] = useState<IntegranteRegistradoPayload[]>([]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setConfirmandoRegenerar(false);
      setError(null);
    }
  }

  // Se pide fresco cada vez que se abre: si el QR se regeneró en otra pestaña
  // u otra sesión, evita mostrar un token ya inválido.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setRecienCensados([]);
    apiFetch<QrInfo>("/integrantes/qr")
      .then(setQrInfo)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo cargar el código QR"))
      .finally(() => setLoading(false));
  }, [open]);

  // Realtime (ver frontend/prompt.md): censo en vivo mientras el diálogo está
  // abierto — pensado para proyectar en pantalla durante el evento. La lista
  // se reinicia cada vez que se abre (arriba), no persiste entre aperturas.
  useRealtimeEvent("integrante:registrado", (integrante) => {
    if (!open) return;
    setRecienCensados((prev) => [integrante, ...prev]);
  });

  useEffect(() => {
    if (!qrInfo) {
      setQrImagen(null);
      return;
    }
    // width alto (no solo los 220px que se muestran en el modal) para que el
    // botón "Descargar" sirva para imprimir sin pixelar; margin en el valor
    // por defecto de la librería (4 módulos) — la zona de silencio recomendada
    // por el estándar QR, importante para que un lector no falle al escanearlo
    // ya impreso junto a otro texto/gráfica.
    QRCode.toDataURL(qrInfo.urlRegistro, { width: 640 })
      .then(setQrImagen)
      .catch(() => setError("No se pudo generar la imagen del código QR"));
  }, [qrInfo]);

  async function copiarLink() {
    if (!qrInfo) return;
    await navigator.clipboard.writeText(qrInfo.urlRegistro);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function regenerar() {
    setRegenerando(true);
    setError(null);
    try {
      const nuevo = await apiFetch<QrInfo>("/integrantes/qr/regenerar", { method: "POST" });
      setQrInfo(nuevo);
      setConfirmandoRegenerar(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo regenerar el código QR");
    } finally {
      setRegenerando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <QrCode className="h-4 w-4" />
          Código QR
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Código QR de tu iglesia</DialogTitle>
          <DialogDescription>
            Imprímelo y compártelo con tu congregación para que se registren escaneándolo.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando código QR...
          </div>
        ) : qrInfo ? (
          <div className="min-w-0 space-y-4">
            <div className="flex justify-center">
              {qrImagen ? (
                // eslint-disable-next-line @next/next/no-img-element -- data: URI generado en cliente, next/image no aplica
                <img
                  src={qrImagen}
                  alt="Código QR de registro de integrantes"
                  width={220}
                  height={220}
                  className="rounded-xl border border-border"
                />
              ) : (
                <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-border bg-muted">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-lg border border-border bg-muted px-3 py-2">
              <p className="truncate text-xs text-muted-foreground" title={qrInfo.urlRegistro}>
                {qrInfo.urlRegistro}
              </p>
            </div>

            <div className="min-w-0 space-y-2 rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium text-foreground">Recién censados</p>
                {recienCensados.length > 0 && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{recienCensados.length}</span>
                )}
              </div>
              {recienCensados.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Todavía nadie se ha registrado con este código en esta sesión.
                </p>
              ) : (
                <div className="max-h-48 space-y-1.5 overflow-y-auto">
                  {recienCensados.map((integrante) => (
                    <div
                      key={integrante.id}
                      className="flex items-center gap-2 rounded-md bg-card px-2 py-1.5 text-sm shadow-sm"
                    >
                      {integrante.fotoUrl ? (
                        <Image
                          src={integrante.fotoUrl}
                          alt=""
                          width={24}
                          height={24}
                          className="h-6 w-6 shrink-0 rounded-full border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                          <User className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <span className="truncate text-foreground">{integrante.nombreCompleto}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {confirmandoRegenerar ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium text-destructive">
                    Esto invalida de inmediato el QR que ya imprimiste. ¿Seguro que quieres regenerarlo?
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setConfirmandoRegenerar(false)}>
                      Cancelar
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={regenerar} disabled={regenerando}>
                      {regenerando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sí, regenerar"}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={copiarLink}>
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiado ? "Copiado" : "Copiar link"}
                </Button>
                {qrImagen ? (
                  <Button type="button" variant="outline" asChild>
                    <a href={qrImagen} download="qr-integrantes.png">
                      <Download className="h-4 w-4" />
                      Descargar
                    </a>
                  </Button>
                ) : (
                  <Button type="button" variant="outline" disabled>
                    <Download className="h-4 w-4" />
                    Descargar
                  </Button>
                )}
              </div>
            )}

            {!confirmandoRegenerar && (
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setConfirmandoRegenerar(true)}
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerar código
                </Button>
              </DialogFooter>
            )}
          </div>
        ) : (
          error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
