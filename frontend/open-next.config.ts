import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Config mínima (default del adapter). Esta app no usa ISR ni `revalidate`
// en fetch del lado servidor -- todas las páginas son "use client" y hacen
// fetching en el navegador vía apiFetch (ver src/lib/api.ts) -- así que no
// hace falta configurar un incremental cache persistente (R2/KV/D1). Si en
// el futuro se agrega alguna página con data fetching real en el servidor,
// revisar https://opennext.js.org/cloudflare/caching antes de asumir que
// el cache en memoria por defecto alcanza.
export default defineCloudflareConfig();
