"use client";

import { usePathname } from "next/navigation";
import { FacturacionAlertas } from "@/components/facturacion/facturacion-alertas";
import { useActivityHeartbeat } from "@/hooks/use-activity-heartbeat";
import { Footer } from "./footer";
import { Navbar } from "./navbar";

const RUTAS_SIN_SHELL = ["/login", "/politica-privacidad"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Se llama incondicionalmente (a diferencia de <FacturacionAlertas/>, un
  // hook no puede quedar detrás del early return de acá abajo — Rules of
  // Hooks). Se auto-gatea internamente (sesión + gates de password/onboarding),
  // así que no hace daño que también corra en las rutas públicas de abajo.
  useActivityHeartbeat();

  const ocultarShell =
    RUTAS_SIN_SHELL.includes(pathname) ||
    pathname.startsWith("/predicacion/") ||
    pathname.startsWith("/integrantes/registro/") ||
    pathname.startsWith("/recuperar-contrasena") ||
    // Links públicos que llegan por correo (sin sesión): estado de convocatoria
    // y RSVP de un integrante. Igual que /predicacion/, van sin navbar/footer.
    pathname.startsWith("/agenda/convocatoria/") ||
    pathname.startsWith("/agenda/asistencia/");

  if (ocultarShell) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <FacturacionAlertas />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
