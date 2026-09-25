"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, ChevronDown, LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PLAN_BADGE_CLASSES, PLAN_LABEL } from "@/components/iglesias/types";
// Derivado de src/img/photo/logo-mark.png (1181x1181, 570 KB): recortado al
// contenido + reducido a 128x128 con sharp. En Cloudflare Workers
// (NEXT_IMAGES_UNOPTIMIZED=true, ver next.config.ts) next/image no reoptimiza
// nada en runtime, así que un <Image> en un header que se pinta en cada
// página tiene que partir ya de un archivo chico — no del logo fuente.
import logoMark from "@/img/photo/logo-mark-nav.png";
import { apiFetch, setCsrfToken } from "@/lib/api";
import { useAuthStore, type SessionUser } from "@/stores/auth-store";

/**
 * Un ítem de navegación es un link directo o un grupo colapsable con sub-links
 * (ej. "Ceremonias" ▾, que despliega sus 4 submódulos dentro del propio panel
 * lateral en vez de navegar a una página propia). Discriminado por `type` para
 * poder mezclar ambos dentro de la misma lista sin romper los links planos que
 * ya existían.
 */
type NavItem =
  | { type: "link"; href: string; label: string }
  | { type: "group"; label: string; children: { href: string; label: string }[] };

const INICIO_LINK: NavItem = { type: "link", href: "/", label: "Inicio" };
const AGENDA_LINK: NavItem = { type: "link", href: "/agenda", label: "Agenda" };
const FINANZAS_LINK: NavItem = { type: "link", href: "/finanzas", label: "Finanzas" };
const NOTAS_LINK: NavItem = { type: "link", href: "/notas", label: "Notas" };
const EQUIPO_LINK: NavItem = { type: "link", href: "/equipo", label: "Equipo" };
const ACCESOS_LINK: NavItem = { type: "link", href: "/accesos", label: "Accesos" };
const INTEGRANTES_LINK: NavItem = { type: "link", href: "/integrantes", label: "Integrantes" };
const MI_IGLESIA_LINK: NavItem = { type: "link", href: "/mi-iglesia", label: "Mi iglesia" };
const FACTURACION_LINK: NavItem = { type: "link", href: "/facturacion", label: "Facturación" };

const CEREMONIAS_GRUPO: NavItem = {
  type: "group",
  label: "Ceremonias",
  children: [
    { href: "/ceremonias/matrimonios", label: "Matrimonios" },
    { href: "/ceremonias/bautizos", label: "Bautizos" },
    { href: "/ceremonias/defunciones", label: "Defunciones" },
    { href: "/ceremonias/presentaciones", label: "Presentaciones" },
  ],
};

// "Mi perfil" aplica a cualquier rol autenticado (ver frontend/prompt.md,
// sección 1) — se agrega al final de la lista de cada rol en vez de vivir en
// un lugar especial de la barra, mismo criterio de link plano que el resto.
const PERFIL_LINK: NavItem = { type: "link", href: "/perfil", label: "Mi perfil" };

/**
 * Mapea cada módulo delegable (id devuelto por `GET /accesos/catalogo`, ver
 * frontend/prompt.md) al ítem de navegación correspondiente. El catálogo puede
 * crecer a futuro sin cambiar el contrato de la API, pero la ruta/ícono/texto
 * de un módulo nuevo sí requiere agregar una entrada acá — no hay forma de
 * inferir eso solo a partir del id que manda el backend. Un módulo del
 * catálogo que no esté en este mapa simplemente no aparece en el menú.
 */
const MODULO_NAV_ITEM: Record<string, NavItem> = {
  AGENDA: AGENDA_LINK,
  FINANZAS: FINANZAS_LINK,
  INTEGRANTES: INTEGRANTES_LINK,
  CEREMONIAS: CEREMONIAS_GRUPO,
};

// Orden de prioridad en el que se muestran los módulos delegables que un
// USUARIO tenga otorgados — criterio propio (no especificado en el brief):
// mismo orden en que ya aparecían para PASTOR/MANAGER.
const ORDEN_MODULOS_USUARIO = ["AGENDA", "FINANZAS", "INTEGRANTES", "CEREMONIAS"];

/**
 * Arma la lista de navegación de la sesión activa. MANAGER ve siempre todo
 * (Notas/Equipo/Accesos/Mi iglesia son exclusivos suyos, no delegables — ver
 * frontend/prompt.md); un USUARIO ve Equipo (mismo criterio de acceso que
 * tenía TESORERO/SECRETARIA antes del rename, no es un módulo delegable) más
 * los módulos que el MANAGER le haya otorgado vía `modulos`. SUPER_ADMIN y
 * MIEMBRO no cambian.
 */
function buildLinks(usuario: SessionUser): NavItem[] {
  if (usuario.rol === "MANAGER") {
    return [
      INICIO_LINK,
      AGENDA_LINK,
      FINANZAS_LINK,
      NOTAS_LINK,
      EQUIPO_LINK,
      ACCESOS_LINK,
      INTEGRANTES_LINK,
      CEREMONIAS_GRUPO,
      MI_IGLESIA_LINK,
      FACTURACION_LINK,
      PERFIL_LINK,
    ];
  }

  if (usuario.rol === "USUARIO") {
    const modulosLinks = ORDEN_MODULOS_USUARIO.filter((modulo) => usuario.modulos.includes(modulo)).map(
      (modulo) => MODULO_NAV_ITEM[modulo],
    );
    return [INICIO_LINK, ...modulosLinks, EQUIPO_LINK, PERFIL_LINK];
  }

  if (usuario.rol === "SUPER_ADMIN") {
    return [INICIO_LINK, { type: "link", href: "/superadmin", label: "Dashboard" }, PERFIL_LINK];
  }

  // MIEMBRO
  return [INICIO_LINK, PERFIL_LINK];
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const usuario = useAuthStore((state) => state.usuario);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set());

  const links = usuario ? buildLinks(usuario) : [];

  // Si la ruta activa cae dentro de un grupo (ej. entrar directo a
  // /ceremonias/bautizos), lo expande automáticamente para que quede visible
  // al abrir el menú — sin esto, un grupo colapsado podría esconder la
  // sección en la que el usuario ya está parado.
  useEffect(() => {
    for (const link of links) {
      if (link.type === "group" && link.children.some((child) => pathname.startsWith(child.href))) {
        setGruposAbiertos((prev) => (prev.has(link.label) ? prev : new Set(prev).add(link.label)));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleGrupo(label: string) {
    setGruposAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  async function handleLogout() {
    setMenuAbierto(false);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // aunque el backend falle, igual cerramos la sesión local
    } finally {
      setCsrfToken(null);
      clearSession();
      router.replace("/login");
    }
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Image src={logoMark} alt="" width={24} height={24} className="h-6 w-6" priority />
            Evangelicapp
          </Link>

          {usuario?.iglesia && (
            <div className="hidden items-center gap-2 border-l border-border pl-6 sm:flex">
              {usuario.iglesia.logoUrl ? (
                <Image
                  src={usuario.iglesia.logoUrl}
                  alt={`Logo de ${usuario.iglesia.nombre}`}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full border border-border object-contain"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-primary">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
              )}
              <span className="text-sm text-muted-foreground">{usuario.iglesia.nombre}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_BADGE_CLASSES[usuario.iglesia.plan]}`}
              >
                {PLAN_LABEL[usuario.iglesia.plan]}
              </span>
            </div>
          )}
        </div>

        {usuario && (
          <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Abrir menú">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-4/5 flex-col overflow-hidden p-0">
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <SheetHeader>
                  <SheetTitle>Menú</SheetTitle>
                </SheetHeader>

                <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-accent/40 px-3 py-3">
                  {usuario.iglesia?.logoUrl ? (
                    <Image
                      src={usuario.iglesia.logoUrl}
                      alt={`Logo de ${usuario.iglesia.nombre}`}
                      width={36}
                      height={36}
                      className="h-9 w-9 shrink-0 rounded-full border border-border object-contain"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">@{usuario.username}</p>
                    {usuario.iglesia && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <p className="truncate text-xs text-muted-foreground">{usuario.iglesia.nombre}</p>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PLAN_BADGE_CLASSES[usuario.iglesia.plan]}`}
                        >
                          {PLAN_LABEL[usuario.iglesia.plan]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {links.length > 0 && (
                  <nav className="mt-4 flex flex-col gap-1">
                    {links.map((link) =>
                      link.type === "group" ? (
                        <div key={link.label}>
                          <button
                            type="button"
                            onClick={() => toggleGrupo(link.label)}
                            aria-expanded={gruposAbiertos.has(link.label)}
                            aria-controls={`grupo-nav-${link.label}`}
                            className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent/60 hover:text-foreground ${
                              link.children.some((child) => pathname === child.href)
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {link.label}
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${gruposAbiertos.has(link.label) ? "rotate-180" : ""}`}
                            />
                          </button>
                          {gruposAbiertos.has(link.label) && (
                            <div id={`grupo-nav-${link.label}`} className="ml-3 mt-1 flex flex-col gap-1 border-l border-border pl-3">
                              {link.children.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={() => setMenuAbierto(false)}
                                  className={
                                    pathname === child.href
                                      ? "rounded-md bg-accent px-3 py-2.5 text-sm font-medium text-primary"
                                      : "rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                                  }
                                >
                                  {child.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMenuAbierto(false)}
                          className={
                            pathname === link.href
                              ? "rounded-md bg-accent px-3 py-2.5 text-sm font-medium text-primary"
                              : "rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                          }
                        >
                          {link.label}
                        </Link>
                      ),
                    )}
                  </nav>
                )}
              </div>

              <div className="shrink-0 border-t border-border px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 text-destructive hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </header>
  );
}
