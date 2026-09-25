/**
 * Versículo del día para el dashboard de Manager/Usuario
 * (`src/components/dashboard/versiculo-del-dia.tsx`).
 *
 * Esta lista es SOLO referencias curadas (cita legible + `passage` en el
 * formato de la API de Biblia.com). El texto NO se guarda acá: lo trae el
 * componente en runtime desde `api.biblia.com` (Reina-Valera 1960) — los
 * términos de esa API prohíben almacenar su contenido, así que no se puede
 * pre-generar un JSON. Ver la entrada de FEATURES.md.
 *
 * `passage` usa nombres de libro en inglés y `capítulo.versículo` (o rango
 * `cap.v-v`), que es lo que entiende el endpoint `/bible/content` — `Juan3.16`
 * da 404, `John3.16` no.
 */

export interface ReferenciaVersiculo {
  /** Cómo se muestra en la UI, en español. */
  cita: string;
  /** Parámetro `passage` de la API de Biblia.com (libro en inglés). */
  passage: string;
}

/**
 * ~100 pasajes conocidos y de ánimo (fe, paz, fortaleza, esperanza, gratitud,
 * el amor de Dios). Todos verificados contra `RVR60` — devuelven texto limpio.
 * Al agregar uno nuevo: confirmar que `GET /bible/content/RVR60.txt.json?passage=<passage>`
 * responde 200 con texto (no 404) y sin basura de notas al pie.
 */
export const VERSICULOS: ReferenciaVersiculo[] = [
  { cita: "Juan 3:16", passage: "John3.16" },
  { cita: "Salmos 23:1", passage: "Ps23.1" },
  { cita: "Filipenses 4:13", passage: "Phil4.13" },
  { cita: "Filipenses 4:6-7", passage: "Phil4.6-7" },
  { cita: "Jeremías 29:11", passage: "Jer29.11" },
  { cita: "Proverbios 3:5-6", passage: "Prov3.5-6" },
  { cita: "Isaías 41:10", passage: "Isa41.10" },
  { cita: "Romanos 8:28", passage: "Rom8.28" },
  { cita: "Josué 1:9", passage: "Josh1.9" },
  { cita: "Salmos 46:1", passage: "Ps46.1" },
  { cita: "Mateo 6:33", passage: "Matt6.33" },
  { cita: "Mateo 11:28", passage: "Matt11.28" },
  { cita: "Salmos 119:105", passage: "Ps119.105" },
  { cita: "2 Corintios 5:17", passage: "2Cor5.17" },
  { cita: "Salmos 37:4", passage: "Ps37.4" },
  { cita: "Isaías 40:31", passage: "Isa40.31" },
  { cita: "Salmos 27:1", passage: "Ps27.1" },
  { cita: "Salmos 91:1-2", passage: "Ps91.1-2" },
  { cita: "Romanos 12:2", passage: "Rom12.2" },
  { cita: "Gálatas 5:22-23", passage: "Gal5.22-23" },
  { cita: "Efesios 2:8-9", passage: "Eph2.8-9" },
  { cita: "Hebreos 11:1", passage: "Heb11.1" },
  { cita: "Hebreos 13:5", passage: "Heb13.5" },
  { cita: "1 Corintios 13:4-7", passage: "1Cor13.4-7" },
  { cita: "Salmos 121:1-2", passage: "Ps121.1-2" },
  { cita: "Mateo 5:16", passage: "Matt5.16" },
  { cita: "Mateo 28:19-20", passage: "Matt28.19-20" },
  { cita: "Juan 14:6", passage: "John14.6" },
  { cita: "Juan 14:27", passage: "John14.27" },
  { cita: "Juan 15:5", passage: "John15.5" },
  { cita: "Romanos 5:8", passage: "Rom5.8" },
  { cita: "Romanos 10:9", passage: "Rom10.9" },
  { cita: "1 Juan 1:9", passage: "1John1.9" },
  { cita: "1 Juan 4:19", passage: "1John4.19" },
  { cita: "Salmos 34:8", passage: "Ps34.8" },
  { cita: "Salmos 34:18", passage: "Ps34.18" },
  { cita: "Salmos 55:22", passage: "Ps55.22" },
  { cita: "Salmos 90:12", passage: "Ps90.12" },
  { cita: "Salmos 100:4-5", passage: "Ps100.4-5" },
  { cita: "Salmos 103:1-2", passage: "Ps103.1-2" },
  { cita: "Salmos 118:24", passage: "Ps118.24" },
  { cita: "Salmos 139:14", passage: "Ps139.14" },
  { cita: "Salmos 143:8", passage: "Ps143.8" },
  { cita: "Proverbios 16:3", passage: "Prov16.3" },
  { cita: "Proverbios 18:10", passage: "Prov18.10" },
  { cita: "Isaías 26:3", passage: "Isa26.3" },
  { cita: "Isaías 43:2", passage: "Isa43.2" },
  { cita: "Lamentaciones 3:22-23", passage: "Lam3.22-23" },
  { cita: "Sofonías 3:17", passage: "Zeph3.17" },
  { cita: "Miqueas 6:8", passage: "Mic6.8" },
  { cita: "Nahúm 1:7", passage: "Nah1.7" },
  { cita: "Habacuc 3:19", passage: "Hab3.19" },
  { cita: "Mateo 7:7", passage: "Matt7.7" },
  { cita: "Marcos 11:24", passage: "Mark11.24" },
  { cita: "Lucas 1:37", passage: "Luke1.37" },
  { cita: "Juan 8:12", passage: "John8.12" },
  { cita: "Juan 16:33", passage: "John16.33" },
  { cita: "Hechos 1:8", passage: "Acts1.8" },
  { cita: "Romanos 8:38-39", passage: "Rom8.38-39" },
  { cita: "Romanos 15:13", passage: "Rom15.13" },
  { cita: "1 Corintios 10:13", passage: "1Cor10.13" },
  { cita: "1 Corintios 16:13-14", passage: "1Cor16.13-14" },
  { cita: "2 Corintios 4:16-18", passage: "2Cor4.16-18" },
  { cita: "2 Corintios 9:7", passage: "2Cor9.7" },
  { cita: "2 Corintios 12:9", passage: "2Cor12.9" },
  { cita: "Gálatas 6:9", passage: "Gal6.9" },
  { cita: "Efesios 3:20", passage: "Eph3.20" },
  { cita: "Efesios 4:32", passage: "Eph4.32" },
  { cita: "Efesios 6:10", passage: "Eph6.10" },
  { cita: "Filipenses 1:6", passage: "Phil1.6" },
  { cita: "Filipenses 4:19", passage: "Phil4.19" },
  { cita: "Colosenses 3:23", passage: "Col3.23" },
  { cita: "1 Tesalonicenses 5:16-18", passage: "1Thess5.16-18" },
  { cita: "2 Timoteo 1:7", passage: "2Tim1.7" },
  { cita: "Hebreos 4:16", passage: "Heb4.16" },
  { cita: "Hebreos 12:1-2", passage: "Heb12.1-2" },
  { cita: "Santiago 1:2-3", passage: "Jas1.2-3" },
  { cita: "Santiago 1:5", passage: "Jas1.5" },
  { cita: "1 Pedro 5:6-7", passage: "1Pet5.6-7" },
  { cita: "1 Juan 4:9-10", passage: "1John4.9-10" },
  { cita: "Apocalipsis 21:4", passage: "Rev21.4" },
  { cita: "Génesis 1:1", passage: "Gen1.1" },
  { cita: "Éxodo 14:14", passage: "Exod14.14" },
  { cita: "Deuteronomio 31:6", passage: "Deut31.6" },
  { cita: "1 Crónicas 16:11", passage: "1Chr16.11" },
  { cita: "Nehemías 8:10", passage: "Neh8.10" },
  { cita: "Salmos 16:8", passage: "Ps16.8" },
  { cita: "Salmos 28:7", passage: "Ps28.7" },
  { cita: "Salmos 62:1-2", passage: "Ps62.1-2" },
  { cita: "Salmos 73:26", passage: "Ps73.26" },
  { cita: "Salmos 84:11", passage: "Ps84.11" },
  { cita: "Salmos 145:18-19", passage: "Ps145.18-19" },
  { cita: "Proverbios 4:23", passage: "Prov4.23" },
  { cita: "Eclesiastés 3:1", passage: "Eccl3.1" },
  { cita: "Isaías 55:8-9", passage: "Isa55.8-9" },
  { cita: "Jeremías 17:7-8", passage: "Jer17.7-8" },
  { cita: "Mateo 19:26", passage: "Matt19.26" },
  { cita: "Juan 13:34-35", passage: "John13.34-35" },
  { cita: "Romanos 12:12", passage: "Rom12.12" },
  { cita: "Colosenses 3:15", passage: "Col3.15" },
];

/**
 * Día del año (0 el 1 de enero) en horario de Chile continental, para que el
 * versículo cambie a la medianoche local y no a las ~21:00 (que es cuando
 * pasa la medianoche UTC en Chile).
 */
function diaDelAnioSantiago(ahora: Date): { anio: number; dia: number } {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
  const [anio, mes, dia] = iso.split("-").map(Number);
  const msPorDia = 86_400_000;
  return {
    anio,
    dia: Math.round((Date.UTC(anio, mes - 1, dia) - Date.UTC(anio, 0, 1)) / msPorDia),
  };
}

/**
 * Referencia determinística para hoy: todos ven el mismo versículo el mismo
 * día. Se suma el año a la rotación para que no arranque siempre en el mismo
 * pasaje cada 1 de enero.
 */
export function getReferenciaDelDia(ahora: Date = new Date()): ReferenciaVersiculo {
  const { anio, dia } = diaDelAnioSantiago(ahora);
  return VERSICULOS[(dia + anio) % VERSICULOS.length];
}
