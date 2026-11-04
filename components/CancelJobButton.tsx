"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  jobId: string;
  projectId: string;
}

/**
 * Cancela um render job em queued/claimed/running com confirmação inline:
 * 1º clique vira "Confirmar?", 2º clique executa. Marca o job como error
 * ("cancelado pelo usuário") e o projeto como erro.
 */
export function CancelJobButton({ jobId, projectId }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Volta ao estado inicial se o usuário não confirmar em 4s.
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  async function handleClick() {
    if (busy) return;
    if (!confirming) {
      setConfirming(true);
      setError(null);
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { error: jobError } = await supabase
      .from("render_jobs")
      .update({ status: "error", error: "cancelado pelo usuário" })
      .eq("id", jobId);

    if (jobError) {
      setError("Não foi possível cancelar.");
      setBusy(false);
      setConfirming(false);
      return;
    }

    await supabase.from("projects").update({ status: "erro" }).eq("id", projectId);

    setBusy(false);
    setConfirming(false);
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={`chip border-red-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 ${
          confirming ? "font-semibold" : ""
        }`}
      >
        {busy ? "Cancelando…" : confirming ? "Confirmar?" : "Cancelar"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
