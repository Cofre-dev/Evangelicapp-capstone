import type { NextConfig } from "next";

// Las imágenes subidas (ej. logos de iglesia) se sirven desde el backend en
// NEXT_PUBLIC_API_URL. Se deriva de esa misma variable para no tener que
// tocar este archivo cuando cambie el dominio del backend en cada entorno.
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001");

// El hostname de Supabase Storage (logos/fotos servidos como URL absoluta) se
// deriva de NEXT_PUBLIC_SUPABASE_URL igual que el del backend arriba: si en algún
// momento hay un proyecto Supabase por entorno, cambiar de entorno es solo
// cambiar la variable, no tocar este archivo. Fallback al proyecto de producción
// (evangelicapp-prod) para builds locales/CI que no definen la variable.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "woerftoeqarupnrggupl.supabase.co";

// La optimización on-the-fly de next/image (endpoint /_next/image) es gratis
// y no requiere config en Vercel. En el deploy a Cloudflare Workers (ver
// wrangler.jsonc, adapter @opennextjs/cloudflare) esa misma optimización
// requiere contratar Cloudflare Images o un loader custom que además ignora
// remotePatterns -- ninguna opción es "gratis y sin config" ahí. Como las
// imágenes de este proyecto (logos de iglesia) ya vienen de un backend y de
// Supabase Storage públicos por HTTPS, la salida simple para Cloudflare es
// desactivar la optimización (next/image se comporta como <img> plano) vía
// esta variable, seteada solo en ese entorno. No afecta Vercel/local: ahí no
// se define y next/image sigue optimizando igual que hoy.
const unoptimizedImages = process.env.NEXT_IMAGES_UNOPTIMIZED === "true";

const nextConfig: NextConfig = {
  images: {
    unoptimized: unoptimizedImages,
    remotePatterns: [
      {
        protocol: apiUrl.protocol === "https:" ? "https" : "http",
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: "/uploads/**",
      },
      // logoUrl/fotoUrl (Iglesia/Usuario/Integrante) ahora son URLs absolutas
      // de Supabase Storage (Fase 1 de docs/supabase.md), no rutas relativas
      // del backend. Bucket público, no requiere credenciales.
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
