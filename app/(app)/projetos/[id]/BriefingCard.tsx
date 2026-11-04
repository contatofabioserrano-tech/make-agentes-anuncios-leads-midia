"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Briefing } from "@/lib/types";
import { updateBriefing } from "./actions";

const FIELDS: { key: keyof Briefing; label: string; placeholder: string }[] = [
  { key: "objetivo", label: "Objetivo", placeholder: "Ex.: gerar leads" },
  { key: "publico", label: "Público", placeholder: "Ex.: mulheres 25–40" },
  { key: "oferta", label: "Oferta", placeholder: "Ex.: 30% off" },
  { key: "cta", label: "CTA", placeholder: "Ex.: Compre agora" },
  { key: "observacoes", label: "Observações", placeholder: "Tom, referências…" },
];

export function BriefingCard({
  projectId,
  briefing,
}: {
  projectId: string;
  briefing: Briefing | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Briefing>(briefing ?? {});
  const [pending, startTransition] = useTransition();

  const entries = FIELDS.filter((f) => (briefing?.[f.key] ?? "").trim());

  function save() {
    startTransition(async () => {
      await updateBriefing(projectId, draft);
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="mt-5 card p-4">
        <div className="flex items-center justify-between">
          <p className="label mb-0">Briefing</p>
          <button
            type="button"
            className="btn-ghost -mr-1.5 !py-1 text-xs"
            onClick={() => {
              setDraft(briefing ?? {});
              setEditing(true);
            }}
          >
            Editar
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="mt-2 text-sm text-muted-fg">
            Nenhum briefing estruturado ainda. Clique em Editar para adicionar.
          </p>
        ) : (
          <dl className="mt-3 space-y-2">
            {entries.map((f) => (
              <div key={f.key}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-fg">
                  {f.label}
                </dt>
                <dd className="text-sm text-ink/80">{briefing?.[f.key]}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5 card p-4">
      <p className="label">Editar briefing</p>
      <div className="space-y-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label" htmlFor={`edit-${f.key}`}>
              {f.label}
            </label>
            {f.key === "observacoes" ? (
              <textarea
                id={`edit-${f.key}`}
                className="input min-h-[64px] resize-y"
                value={draft[f.key] ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                }
                placeholder={f.placeholder}
                disabled={pending}
              />
            ) : (
              <input
                id={`edit-${f.key}`}
                className="input"
                value={draft[f.key] ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                }
                placeholder={f.placeholder}
                disabled={pending}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="btn-secondary !py-2 text-sm"
          onClick={() => setEditing(false)}
          disabled={pending}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primary !py-2 text-sm"
          onClick={save}
          disabled={pending}
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
