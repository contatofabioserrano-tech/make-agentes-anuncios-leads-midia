"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Atualiza a página a cada `ms` enquanto `active` (acompanhamento ao vivo do agente). */
export function AutoRefresh({ active, ms = 4000 }: { active: boolean; ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [active, ms, router]);
  return active ? (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-fg">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> ao vivo
    </span>
  ) : null;
}
