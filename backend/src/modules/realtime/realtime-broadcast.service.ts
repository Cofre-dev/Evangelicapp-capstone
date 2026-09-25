import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Quita las `/` finales de una URL de config sin regex (evita `...//realtime/...`). */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charAt(end - 1) === '/') {
    end -= 1;
  }
  return value.slice(0, end);
}

/**
 * Envío de mensajes de Supabase Realtime Broadcast desde el backend, vía el
 * endpoint REST `/realtime/v1/api/broadcast` del proyecto (ver
 * docs/realtime-migration.md). Reemplaza progresivamente al `Server` de
 * socket.io: el backend sigue siendo el ÚNICO emisor (los clientes solo
 * escuchan), igual que con el gateway propio.
 *
 * Autentica con la `service_role` key (misma que ya usa SupabaseStorageService)
 * — el envío por REST con esa key está exento de las policies RLS de
 * `realtime.messages`; esas policies solo gobiernan quién puede *recibir* en
 * cada topic (ver la migración `..._realtime_broadcast_authorization`).
 *
 * Best-effort a propósito: un fallo de red hacia Supabase no debe romper la
 * request de negocio que disparó el evento (marcar pagada una iglesia, un
 * predicador confirmando, un integrante registrándose por QR). Igual criterio
 * que el emit de socket.io, que tampoco lanza.
 */
@Injectable()
export class RealtimeBroadcastService {
  private readonly logger = new Logger(RealtimeBroadcastService.name);
  private readonly endpoint: string | null;
  private readonly serviceRoleKey: string | null;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    const url = stripTrailingSlashes(config.get<string>('SUPABASE_URL')?.trim() ?? '');
    this.endpoint = url ? `${url}/realtime/v1/api/broadcast` : null;
    this.serviceRoleKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? null;
    // Escotilla para apagar el emit por Supabase sin redeploy de código (deja
    // solo socket.io) mientras dure el parallel-run. Default: encendido.
    this.enabled = config.get<string>('REALTIME_BROADCAST_ENABLED', 'true') !== 'false';

    if (!this.endpoint || !this.serviceRoleKey) {
      this.logger.warn(
        'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY sin configurar — el broadcast a Supabase Realtime queda inerte (socket.io sigue funcionando).',
      );
    }
  }

  /**
   * Publica un evento en un topic privado. `topic` ya viene scopeado por el
   * llamador (`SUPERADMIN_TOPIC` o `tenantTopic(iglesiaId)`), nunca por un valor
   * del cliente.
   */
  async publish(topic: string, event: string, payload: unknown): Promise<void> {
    if (!this.enabled || !this.endpoint || !this.serviceRoleKey) {
      return;
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ topic, event, payload, private: true }],
        }),
      });

      if (!response.ok) {
        const detalle = await response.text();
        this.logger.warn(`Broadcast "${event}" a "${topic}" respondió ${response.status}: ${detalle}`);
      }
    } catch (error) {
      this.logger.warn(`Broadcast "${event}" a "${topic}" falló: ${(error as Error).message}`);
    }
  }
}
