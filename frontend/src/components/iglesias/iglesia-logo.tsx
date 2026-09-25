import Image from "next/image";
import { Building2 } from "lucide-react";

/** Compartido entre el dashboard de SuperAdmin, el listado de Iglesias y el
 * detalle — antes vivía duplicado/local a `superadmin/page.tsx`. */
export function IglesiaLogo({
  logoUrl,
  nombre,
  size = 32,
}: {
  logoUrl: string | null;
  nombre: string;
  size?: number;
}) {
  if (!logoUrl) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-accent text-primary"
        style={{ width: size, height: size }}
      >
        <Building2 className="h-1/2 w-1/2" />
      </div>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={`Logo de ${nombre}`}
      width={size}
      height={size}
      className="shrink-0 rounded-full border border-border object-contain"
      style={{ width: size, height: size }}
    />
  );
}
