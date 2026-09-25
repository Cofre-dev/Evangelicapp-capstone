"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ContextoFinanzas, Departamento } from "./types";

const VALOR_GENERAL = "general";

interface DepartamentoSelectorProps {
  /** Ya filtrados a `activo: true` — los archivados no aparecen acá (siguen
   * accesibles solo si se llega directo por URL con su departamentoId). */
  departamentosActivos: Departamento[];
  contexto: ContextoFinanzas;
  esManager: boolean;
  /** Ruta sobre la que navega al cambiar de contexto — permite reusar el
   * selector en cualquier sub-página de Finanzas (ej. `/finanzas/analitica`)
   * sin que el cambio de departamento te saque de ahí. Default `/finanzas`
   * preserva el comportamiento original. */
  basePath?: string;
}

export function DepartamentoSelector({
  departamentosActivos,
  contexto,
  esManager,
  basePath = "/finanzas",
}: DepartamentoSelectorProps) {
  const router = useRouter();

  const value = contexto.tipo === "general" ? VALOR_GENERAL : contexto.id;

  function onValueChange(nextValue: string) {
    if (nextValue === VALOR_GENERAL) {
      router.push(basePath);
    } else {
      router.push(`${basePath}?departamentoId=${nextValue}`);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={VALOR_GENERAL}>Finanzas general</SelectItem>
          {departamentosActivos.map((dep) => (
            <SelectItem key={dep.id} value={dep.id}>
              {dep.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {esManager && (
        <Button variant="outline" size="icon" aria-label="Gestionar departamentos" asChild>
          <Link href="/finanzas/departamentos">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}
