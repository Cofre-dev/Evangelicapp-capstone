/**
 * Migración única (Fase 1 de docs/supabase.md): sube los archivos que hoy viven en
 * backend/uploads/{logos,perfiles,integrantes} al Supabase Storage correspondiente
 * y actualiza Iglesia.logoUrl / Usuario.fotoUrl / Integrante.fotoUrl con la nueva
 * URL pública. Opera sobre la BD que apunte el DATABASE_URL activo en .env — correrla
 * de nuevo contra otra BD (ej. al volver a Supabase como fuente de verdad) es seguro:
 * solo toca filas cuyo valor todavía sea una ruta relativa "/uploads/...".
 *
 * Uso: npm run migrate:uploads
 */
import { PrismaClient } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { basename, extname, join } from 'path';

const prisma = new PrismaClient();
const UPLOADS_DIR = join(__dirname, '..', 'uploads');

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

async function subirArchivo(
  supabase: SupabaseClient,
  bucket: string,
  carpetaLocal: string,
  fileName: string,
): Promise<string | null> {
  const filePath = join(UPLOADS_DIR, carpetaLocal, fileName);
  if (!existsSync(filePath)) {
    console.warn(`  [omitido] no existe en disco: ${filePath}`);
    return null;
  }

  const buffer = await readFile(filePath);
  const contentType = MIME_BY_EXTENSION[extname(fileName).toLowerCase()] ?? 'application/octet-stream';

  const { error } = await supabase.storage.from(bucket).upload(fileName, buffer, { contentType, upsert: true });
  if (error) {
    console.error(`  [error] subiendo ${fileName} a ${bucket}: ${error.message}`);
    return null;
  }

  return supabase.storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
}

async function migrarIglesias(supabase: SupabaseClient): Promise<void> {
  const iglesias = await prisma.iglesia.findMany({
    where: { logoUrl: { startsWith: '/uploads/logos/' } },
    select: { id: true, nombre: true, logoUrl: true },
  });

  console.log(`Iglesia.logoUrl: ${iglesias.length} por migrar`);
  for (const iglesia of iglesias) {
    const fileName = basename(iglesia.logoUrl!);
    const publicUrl = await subirArchivo(supabase, 'logos-iglesias', 'logos', fileName);
    if (!publicUrl) continue;

    await prisma.iglesia.update({ where: { id: iglesia.id }, data: { logoUrl: publicUrl } });
    console.log(`  ${iglesia.nombre}: ${iglesia.logoUrl} -> ${publicUrl}`);
  }
}

async function migrarUsuarios(supabase: SupabaseClient): Promise<void> {
  const usuarios = await prisma.usuario.findMany({
    where: { fotoUrl: { startsWith: '/uploads/perfiles/' } },
    select: { id: true, username: true, fotoUrl: true },
  });

  console.log(`Usuario.fotoUrl: ${usuarios.length} por migrar`);
  for (const usuario of usuarios) {
    const fileName = basename(usuario.fotoUrl!);
    const publicUrl = await subirArchivo(supabase, 'fotos-perfil', 'perfiles', fileName);
    if (!publicUrl) continue;

    await prisma.usuario.update({ where: { id: usuario.id }, data: { fotoUrl: publicUrl } });
    console.log(`  ${usuario.username}: ${usuario.fotoUrl} -> ${publicUrl}`);
  }
}

async function migrarIntegrantes(supabase: SupabaseClient): Promise<void> {
  const integrantes = await prisma.integrante.findMany({
    where: { fotoUrl: { startsWith: '/uploads/integrantes/' } },
    select: { id: true, nombreCompleto: true, fotoUrl: true },
  });

  console.log(`Integrante.fotoUrl: ${integrantes.length} por migrar`);
  for (const integrante of integrantes) {
    const fileName = basename(integrante.fotoUrl!);
    const publicUrl = await subirArchivo(supabase, 'fotos-integrantes', 'integrantes', fileName);
    if (!publicUrl) continue;

    await prisma.integrante.update({ where: { id: integrante.id }, data: { fotoUrl: publicUrl } });
    console.log(`  ${integrante.nombreCompleto}: ${integrante.fotoUrl} -> ${publicUrl}`);
  }
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el .env activo. Nada que migrar.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  await migrarIglesias(supabase);
  await migrarUsuarios(supabase);
  await migrarIntegrantes(supabase);

  console.log('Migración terminada.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
