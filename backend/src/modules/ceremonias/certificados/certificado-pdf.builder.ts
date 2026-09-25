import PDFDocument from 'pdfkit';
import { formatearFechaLarga } from '../../../common/utils/formatear-fecha';

/** Colores del layout — mismo tono ámbar/dorado del diseño original en `backend/certificado/`. */
const COLOR_BORDE = '#c9a15a';
const COLOR_TITULO = '#1f1f1f';
const COLOR_SUBTITULO = '#8a6a2f';
const COLOR_TEXTO = '#2a2a2a';
const COLOR_CAPTION = '#6b6b6b';

export interface CertificadoParrafoSegmento {
  texto: string;
  negrita?: boolean;
}

export interface CertificadoPdfOptions {
  /** Ej. "DE MATRIMONIO", "DE BAUTISMO". */
  subtitulo: string;
  /** Ej. "PASTOR(A) QUE OFICIÓ LA CEREMONIA". */
  firmaCaption: string;
  parrafo: CertificadoParrafoSegmento[];
  nombrePastor: string;
  folio: number;
  iglesia: { nombre: string; logoUrl: string | null };
}

/**
 * `doc.image()` de pdfkit solo soporta PNG/JPEG. Desde el fix de `logo-upload.config.ts`,
 * los logos nuevos (alta de iglesia o `PATCH /mi-iglesia/logo`) son siempre PNG — este
 * chequeo queda como red de seguridad para logos WEBP subidos antes del fix, que se
 * omiten en el certificado (círculo vacío) en vez de romper la generación del PDF.
 *
 * El logo vive en el bucket público `logos-iglesias` de Supabase Storage (Fase 1 de
 * docs/supabase.md) — se descarga por HTTP en vez de leerse de disco. Si la descarga
 * falla (bucket caído, URL vieja, etc.), se omite igual que un mimetype no soportado:
 * el certificado no debe romperse por un logo que no cargó.
 */
async function resolverLogoBuffer(logoUrl: string | null): Promise<Buffer | null> {
  if (!logoUrl) return null;
  if (!/\.(png|jpe?g)$/i.test(logoUrl)) return null;

  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export async function generarCertificadoPdf(options: CertificadoPdfOptions): Promise<Buffer> {
  const logoBuffer = await resolverLogoBuffer(options.iglesia.logoUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    dibujarCertificado(doc, options, logoBuffer);

    doc.end();
  });
}

function dibujarCertificado(
  doc: PDFKit.PDFDocument,
  options: CertificadoPdfOptions,
  logoBuffer: Buffer | null,
): void {
  const { width, height } = doc.page;
  const margenExterior = 28;
  const padding = 56;
  const anchoUtil = width - padding * 2;

  // Borde exterior
  doc
    .lineWidth(1.5)
    .rect(margenExterior, margenExterior, width - margenExterior * 2, height - margenExterior * 2)
    .stroke(COLOR_BORDE);

  // Folio (arriba izquierda) y fecha de emisión (arriba derecha): fecha en que se generó
  // ESTA versión del PDF. Desde la Fase 3 de docs/supabase.md (caché de certificados en
  // Supabase Storage, ver `SupabaseStorageService#getOrGenerate`), una reimpresión que pega
  // en el caché reutiliza el PDF ya generado — la fecha de emisión NO se actualiza en cada
  // descarga, queda fija en el momento del cacheo. Decisión consciente, confirmada con el
  // fundador: la fecha real de la ceremonia (ver cuerpo del certificado) es la que importa
  // legalmente y siempre es correcta; esta es solo metadata administrativa.
  const fechaEmision = formatearFechaLarga(new Date());
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLOR_CAPTION)
    .text(`N.° ${options.folio}`, padding, 44, { width: 200, align: 'left' });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLOR_CAPTION)
    .text(fechaEmision, width - padding - 200, 44, {
      width: 200,
      align: 'right',
    });

  // Logo circular
  const logoSize = 64;
  const logoCenterX = width / 2;
  const logoTopY = 50;

  doc.save();
  doc.circle(logoCenterX, logoTopY + logoSize / 2, logoSize / 2).clip();
  if (logoBuffer) {
    doc.image(logoBuffer, logoCenterX - logoSize / 2, logoTopY, {
      fit: [logoSize, logoSize],
      align: 'center',
      valign: 'center',
    });
  }
  doc.restore();
  doc
    .lineWidth(1)
    .circle(logoCenterX, logoTopY + logoSize / 2, logoSize / 2)
    .stroke(COLOR_BORDE);

  let cursorY = logoTopY + logoSize + 14;

  // Nombre de la iglesia
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor(COLOR_CAPTION)
    .text(options.iglesia.nombre.toUpperCase(), padding, cursorY, { width: anchoUtil, align: 'center' });
  cursorY += 26;

  // Título
  doc
    .font('Helvetica-Bold')
    .fontSize(34)
    .fillColor(COLOR_TITULO)
    .text('CERTIFICADO', padding, cursorY, { width: anchoUtil, align: 'center', characterSpacing: 2 });
  cursorY += 46;

  // Subtítulo
  doc
    .font('Helvetica-Oblique')
    .fontSize(15)
    .fillColor(COLOR_SUBTITULO)
    .text(options.subtitulo, padding, cursorY, { width: anchoUtil, align: 'center' });
  cursorY += 30;

  // Separador con cruz al centro
  const separadorAncho = 70;
  const centroX = width / 2;
  doc
    .moveTo(centroX - separadorAncho, cursorY)
    .lineTo(centroX - 10, cursorY)
    .moveTo(centroX + 10, cursorY)
    .lineTo(centroX + separadorAncho, cursorY)
    .lineWidth(1)
    .stroke(COLOR_BORDE);
  dibujarCruz(doc, centroX, cursorY);
  cursorY += 36;

  // Párrafo del cuerpo, justificado, con segmentos en negrita
  doc.fontSize(12).fillColor(COLOR_TEXTO);
  const anchoParrafo = anchoUtil - 80;
  const xParrafo = padding + 40;
  doc.x = xParrafo;
  doc.y = cursorY;
  options.parrafo.forEach((segmento, index) => {
    doc.font(segmento.negrita ? 'Helvetica-Bold' : 'Helvetica');
    const esUltimo = index === options.parrafo.length - 1;
    doc.text(segmento.texto, {
      continued: !esUltimo,
      width: anchoParrafo,
      align: 'justify',
      lineGap: 4,
    });
  });
  cursorY = doc.y + 60;

  // Firma
  const firmaAncho = 220;
  const firmaX = centroX - firmaAncho / 2;
  doc
    .moveTo(firmaX, cursorY)
    .lineTo(firmaX + firmaAncho, cursorY)
    .lineWidth(1)
    .stroke(COLOR_TEXTO);
  cursorY += 8;
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLOR_TITULO)
    .text(options.nombrePastor, padding, cursorY, { width: anchoUtil, align: 'center' });
  cursorY += 16;
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLOR_CAPTION)
    .text(options.firmaCaption.toUpperCase(), padding, cursorY, {
      width: anchoUtil,
      align: 'center',
      characterSpacing: 0.5,
    });

  // Marca al pie
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLOR_CAPTION)
    .text('EvangelicApp', width - margenExterior - 120, height - margenExterior - 20, {
      width: 100,
      align: 'right',
    });
}

function dibujarCruz(doc: PDFKit.PDFDocument, centerX: number, centerY: number): void {
  const alto = 14;
  const ancho = 9;
  doc
    .save()
    .lineWidth(1.5)
    .moveTo(centerX, centerY - alto / 2)
    .lineTo(centerX, centerY + alto / 2)
    .moveTo(centerX - ancho / 2, centerY - alto / 6)
    .lineTo(centerX + ancho / 2, centerY - alto / 6)
    .stroke(COLOR_BORDE)
    .restore();
}
