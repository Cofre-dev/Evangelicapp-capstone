"use client";

import { useEffect, useState } from "react";

import { getReferenciaDelDia } from "@/lib/versiculos";

/**
 * Versículo del día en el dashboard de Manager/Usuario. Reemplazó al widget de
 * "tiempo en la app" (ver FEATURES.md).
 *
 * El texto lo trae `api.biblia.com` (Reina-Valera 1960) en el cliente — no se
 * puede pre-generar un JSON, los términos de esa API prohíben almacenar su
 * contenido. Sí se cachea en `localStorage` el versículo de hoy (una entrada,
 * se descarta a la medianoche de Chile) para no pegarle a la API en cada carga.
 *
 * `NEXT_PUBLIC_BIBLIA_API_KEY` es una key "Web" de biblia.com atada al dominio
 * (misma categoría no-secreta que la anon key de Supabase). Si falta, o si la
 * request falla (red, API caída), la card simplemente no se renderiza — nunca
 * rompe el dashboard.
 */

const API_KEY = process.env.NEXT_PUBLIC_BIBLIA_API_KEY;
const CACHE_PREFIX = "versiculo-del-dia:";

interface Versiculo {
  cita: string;
  texto: string;
}

/**
 * La API concatena los versículos de un rango a veces sin espacio tras el
 * punto/coma ("...esforzaos.Todas...", "...fe,mansedumbre..."). En el texto
 * bíblico limpio, un signo de puntuación nunca va pegado a una letra, así que
 * insertar un espacio ahí es seguro. También colapsa los saltos de línea de
 * la poesía (Salmos) a espacios.
 */
function normalizar(texto: string): string {
  return texto
    .replace(/\s+/g, " ")
    .replace(/([.,;:])(?=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡])/g, "$1 ")
    .trim();
}

function claveHoy(): string {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `${CACHE_PREFIX}${iso}`;
}

export function VersiculoDelDia() {
  const [versiculo, setVersiculo] = useState<Versiculo | null>(null);

  useEffect(() => {
    if (!API_KEY) return;

    const referencia = getReferenciaDelDia();
    const cacheKey = claveHoy();

    try {
      const cache = window.localStorage.getItem(cacheKey);
      if (cache) {
        const previo = JSON.parse(cache) as Versiculo;
        if (previo?.texto && previo.cita === referencia.cita) {
          setVersiculo(previo);
          return;
        }
      }
    } catch {
      // localStorage no disponible o dato corrupto — se sigue al fetch.
    }

    const controlador = new AbortController();

    (async () => {
      try {
        const url =
          `https://api.biblia.com/v1/bible/content/RVR60.txt.json` +
          `?passage=${encodeURIComponent(referencia.passage)}&key=${API_KEY}`;
        const res = await fetch(url, { signal: controlador.signal });
        if (!res.ok) return;

        const data = (await res.json()) as { text?: string };
        const texto = normalizar(data.text ?? "");
        if (!texto) return;

        const nuevo: Versiculo = { cita: referencia.cita, texto };
        setVersiculo(nuevo);
        try {
          // Limpia la clave de días anteriores antes de escribir la de hoy.
          for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith(CACHE_PREFIX) && k !== cacheKey) {
              window.localStorage.removeItem(k);
            }
          }
          window.localStorage.setItem(cacheKey, JSON.stringify(nuevo));
        } catch {
          // Cuota llena o modo privado — el caché es opcional.
        }
      } catch {
        // Abort, red caída o API caída: la card no aparece, sin ruido.
      }
    })();

    return () => controlador.abort();
  }, []);

  if (!versiculo) return null;

  return (
    <section
      aria-label="Versículo del día"
      className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      <p className="text-sm text-muted-foreground">Versículo del día</p>
      <blockquote className="mt-2 font-display text-lg italic leading-relaxed text-foreground">
        «{versiculo.texto}»
      </blockquote>
      <p className="mt-3 text-sm font-medium text-primary">{versiculo.cita}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Reina-Valera 1960 · vía{" "}
        <a
          href="https://biblia.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Biblia.com
        </a>
      </p>
    </section>
  );
}
