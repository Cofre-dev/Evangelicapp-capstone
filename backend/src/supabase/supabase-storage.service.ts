import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const PUBLIC_URL_PATTERN = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;

/**
 * Cómo encajar la imagen en el recuadro `width`x`height` al redimensionar:
 * `inside` conserva el aspect ratio completo sin recortar (para logos, que no
 * son necesariamente cuadrados y no deben perder contenido); `cover` recorta
 * para llenar el cuadrado exacto (para avatares, donde un tamaño consistente
 * importa más que preservar cada borde de la foto original).
 */
export interface ImageResizeOptions {
  width: number;
  height: number;
  fit: 'inside' | 'cover';
}

/**
 * Storage de Supabase para logos/fotos/certificados. Los buckets de imágenes
 * (`logos-iglesias`, `fotos-perfil`, `fotos-integrantes`) son públicos de
 * lectura — por eso el valor que se persiste en `logoUrl`/`fotoUrl` es
 * directamente la URL pública, sin necesidad de generar URLs firmadas en cada
 * lectura. El bucket de certificados (`certificados-ceremonias`) es privado:
 * contiene PII de ceremonias reales y solo se reparte a través del endpoint
 * autenticado que ya validaba `iglesiaId`/rol antes de esta fase — no a través
 * de una URL pública del bucket.
 *
 * Usa la service_role key: el backend es el único que escribe (multer ya validó
 * mimetype/tamaño antes de llegar acá), no hay Supabase Auth todavía (Fase 7 del
 * plan) así que no existe un JWT de usuario contra el que aplicar RLS.
 */
@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly client: ReturnType<typeof createClient>;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    );
  }

  /**
   * Sube un archivo y devuelve su URL pública. Si se pasa `resize`, la imagen se
   * redimensiona y recomprime antes de subir (mismo formato de entrada, nunca se
   * agranda una imagen más chica que el objetivo — `withoutEnlargement`). No
   * cambia el mimetype ni la extensión: solo se toca el buffer.
   */
  async upload(
    bucket: string,
    objectName: string,
    file: Express.Multer.File,
    resize?: ImageResizeOptions,
  ): Promise<string> {
    const buffer = resize ? await this.optimizeImage(file.buffer, file.mimetype, resize) : file.buffer;
    await this.putObject(bucket, objectName, buffer, file.mimetype, false);

    return this.client.storage.from(bucket).getPublicUrl(objectName).data.publicUrl;
  }

  /**
   * Caché de un artefacto costoso de generar (ej. un PDF armado con pdfkit): si
   * `objectName` ya existe en `bucket`, lo descarga y devuelve ese buffer sin
   * llamar a `generate`. Si no existe, genera, sube (best-effort — si falla la
   * subida solo se pierde el cacheo, `generate()` ya produjo el resultado a
   * devolver) y devuelve el buffer recién generado.
   *
   * A diferencia de `upload`, este bucket no necesita ser público: quien llama a
   * este método es el único que reparte el contenido (vía su propio endpoint
   * autenticado), nunca se construye una URL pública del objeto cacheado.
   */
  async getOrGenerate(bucket: string, objectName: string, generate: () => Promise<Buffer>): Promise<Buffer> {
    const cached = await this.download(bucket, objectName);
    if (cached) return cached;

    const buffer = await generate();
    await this.putObject(bucket, objectName, buffer, 'application/pdf', true);
    return buffer;
  }

  private async download(bucket: string, objectName: string): Promise<Buffer | null> {
    const { data, error } = await this.client.storage.from(bucket).download(objectName);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }

  private async putObject(
    bucket: string,
    objectName: string,
    buffer: Buffer,
    contentType: string,
    upsert: boolean,
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(bucket)
      .upload(objectName, buffer, { contentType, upsert });

    if (error) {
      if (upsert) {
        // Caché: no debe tumbar la respuesta al usuario si falla, solo se pierde el ahorro de la próxima vez.
        this.logger.warn(`No se pudo cachear ${bucket}/${objectName}: ${error.message}`);
        return;
      }
      throw new InternalServerErrorException(
        `No se pudo subir el archivo a Supabase Storage: ${error.message}`,
      );
    }
  }

  private async optimizeImage(
    buffer: Buffer,
    mimetype: string,
    { width, height, fit }: ImageResizeOptions,
  ): Promise<Buffer> {
    const pipeline = sharp(buffer).resize(width, height, { fit, withoutEnlargement: true });

    switch (mimetype) {
      case 'image/jpeg':
        return pipeline.jpeg({ quality: 80 }).toBuffer();
      case 'image/webp':
        return pipeline.webp({ quality: 80 }).toBuffer();
      case 'image/png':
      default:
        return pipeline.png({ compressionLevel: 9 }).toBuffer();
    }
  }

  /**
   * Borra un objeto a partir de su URL pública. Best-effort (mismo criterio que el
   * `unlink(...).catch(() => undefined)` a disco que reemplaza): si falla, solo
   * queda un objeto huérfano en el bucket, no debe tumbar la operación principal.
   */
  async removeByPublicUrl(publicUrl: string): Promise<void> {
    const parsed = this.parsePublicUrl(publicUrl);
    if (!parsed) return;

    const { error } = await this.client.storage.from(parsed.bucket).remove([parsed.objectName]);
    if (error) {
      this.logger.warn(`No se pudo borrar ${publicUrl} de Supabase Storage: ${error.message}`);
    }
  }

  private parsePublicUrl(url: string): { bucket: string; objectName: string } | null {
    const match = PUBLIC_URL_PATTERN.exec(url);
    if (!match) return null;
    return { bucket: match[1], objectName: decodeURIComponent(match[2]) };
  }
}
