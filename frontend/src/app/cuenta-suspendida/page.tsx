"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

const CONTACTO_EMAIL = "contacto@evangelicapp.cl";

function CuentaSuspendidaContent() {
  const searchParams = useSearchParams();
  const dias = Number(searchParams.get("dias") ?? "0") || 0;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-8 w-8" />
      </div>

      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Cuenta suspendida</h1>
        <p className="text-sm text-muted-foreground">No han pagado la mensualidad, pónganse al día.</p>
        <p className="text-sm text-muted-foreground">
          Llevan {dias} {dias === 1 ? "día" : "días"} de atraso en el pago de tu mensualidad.
        </p>
      </div>

      <Button asChild>
        <a href={`mailto:${CONTACTO_EMAIL}`}>
          <Mail className="h-4 w-4" />
          Contactar a {CONTACTO_EMAIL}
        </a>
      </Button>

      <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
        Volver al inicio de sesión
      </Link>
    </main>
  );
}

export default function CuentaSuspendidaPage() {
  return (
    <Suspense fallback={null}>
      <CuentaSuspendidaContent />
    </Suspense>
  );
}
