"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* navegador sem permissão de clipboard: o texto continua visível para copiar à mão */
        }
      }}
      className="shrink-0 rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-ink transition hover:border-brand-violet hover:text-brand-violet"
    >
      {done ? "Copiado ✓" : label}
    </button>
  );
}
