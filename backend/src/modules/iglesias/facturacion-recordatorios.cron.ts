import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Rol } from '@prisma/client';
import { runAsService } from '../../common/context/tenant-context';
import { calcularEstadoFacturacion } from '../../common/utils/calcular-facturacion';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

const DIAS_AVISO_PREVENTIVO = 7;

/**
 * Recordatorios automáticos de facturación (Fase 4 de docs/supabase.md), corriendo
 * dentro del propio proceso Nest (`@nestjs/schedule`) en vez de un Edge Function
 * separado como sugería el plan original: el backend ya corre siempre activo (no
 * serverless, ver despliegue en Render), así que no hace falta exponer un endpoint
 * interno protegido ni duplicar la lógica de envío en Deno — se reutiliza
 * `MailService` directo.
 *
 * Reglas de negocio (definidas por el fundador):
 * - 7 días antes del vencimiento: un correo preventivo.
 * - Ya vencida: un correo cada 2 días (día 1, 3, 5, 7... de mora), no todos los días.
 *
 * Ambas condiciones se evalúan como "es exactamente hoy" (`diasParaFacturacion === 7`
 * / `diasEnMora` impar), sin ningún estado persistido de "ya se avisó" — mismo
 * criterio stateless que ya usa `calcularEstadoFacturacion` para el semáforo. Si el
 * cron no llega a correr justo ese día (redeploy, caída puntual), ese envío se
 * pierde sin reintento; dado que es un aviso de cortesía (no bloquea nada por sí
 * solo — el corte real de acceso lo sigue haciendo `IglesiasService#ocultar`), no se
 * justificó agregar una columna de tracking solo para este caso.
 */
@Injectable()
export class FacturacionRecordatoriosCron {
  private readonly logger = new Logger(FacturacionRecordatoriosCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async ejecutar(): Promise<void> {
    // Fase 8 de docs/supabase.md (RLS): no hay request HTTP acá (corre por cron), así que
    // no existe contexto de tenant salvo que se abra a mano. Bypass legítimo — este job
    // necesita leer todas las iglesias a propósito, no una en particular.
    return runAsService(() => this.ejecutarComoServicio());
  }

  private async ejecutarComoServicio(): Promise<void> {
    const iglesias = await this.prisma.iglesia.findMany({
      select: {
        id: true,
        nombre: true,
        proximaFacturacion: true,
        usuarios: {
          where: { rol: Rol.MANAGER, activo: true },
          select: { email: true },
          take: 1,
        },
      },
    });

    let enviados = 0;
    for (const iglesia of iglesias) {
      // No debería pasar (toda iglesia se crea con su manager), pero una cuenta
      // desactivada a mano no debe tumbar la corrida del resto de las iglesias.
      const manager = iglesia.usuarios[0];
      if (!manager) continue;

      const { diasParaFacturacion, enMora, diasEnMora } = calcularEstadoFacturacion(
        iglesia.proximaFacturacion,
      );

      if (diasParaFacturacion === DIAS_AVISO_PREVENTIVO) {
        await this.mailService.enviarRecordatorioFacturacion({
          email: manager.email,
          nombreIglesia: iglesia.nombre,
          proximaFacturacion: iglesia.proximaFacturacion,
        });
        enviados++;
      } else if (enMora && diasEnMora % 2 === 1) {
        await this.mailService.enviarFacturacionVencida({
          email: manager.email,
          nombreIglesia: iglesia.nombre,
          diasEnMora,
        });
        enviados++;
      }
    }

    if (enviados > 0) {
      this.logger.log(`Recordatorios de facturación: ${enviados} correo(s) enviado(s).`);
    }
  }
}
