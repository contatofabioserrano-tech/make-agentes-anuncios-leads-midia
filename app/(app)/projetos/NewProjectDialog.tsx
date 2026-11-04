"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CAMPAIGNS } from "@/lib/flow";
import type { Briefing, Campaign } from "@/lib/types";

type Step = "idle" | "uploading" | "saving";
type CampaignChoice = Campaign | "none";

const CAMPAIGN_OPTIONS: { value: CampaignChoice; label: string }[] = [
  { value: "meta", label: CAMPAIGNS.meta.label },
  { value: "google", label: CAMPAIGNS.google.label },
  { value: "none", label: "Nenhuma (9:16 padrão)" },
];

export function NewProjectDialog({ folders = [] }: { folders?: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [folder, setFolder] = useState("Geral");
  const [campaign, setCampaign] = useState<CampaignChoice>("meta");
  const [briefing, setBriefing] = useState<Briefing>({});
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const busy = step !== "idle";

  function setB(key: keyof Briefing, value: string) {
    setBriefing((b) => ({ ...b, [key]: value }));
  }

  function reset() {
    setName("");
    setBrief("");
    setFolder("Geral");
    setCampaign("meta");
    setBriefing({});
    setFile(null);
    setError(null);
    setStep("idle");
  }

  function close() {
    if (busy) return;
    setOpen(false);
    reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Selecione um arquivo de vídeo.");
      return;
    }
    if (!name.trim()) {
      setError("Dê um nome ao projeto.");
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sessão expirada. Faça login novamente.");
      return;
    }

    // Campaign fixes the aspect ratio.
    const aspect = campaign === "none" ? "9:16" : CAMPAIGNS[campaign].aspect;
    const campaignValue: Campaign | null = campaign === "none" ? null : campaign;

    // Only persist filled briefing fields.
    const cleanBriefing: Briefing = {};
    (Object.keys(briefing) as (keyof Briefing)[]).forEach((k) => {
      const v = (briefing[k] ?? "").trim();
      if (v) cleanBriefing[k] = v;
    });
    const hasBriefing = Object.keys(cleanBriefing).length > 0;

    try {
      setStep("uploading");
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "video/mp4",
        });

      if (uploadError) {
        setError("Falha no upload do vídeo. Tente novamente.");
        setStep("idle");
        return;
      }

      setStep("saving");
      const { data: project, error: insertError } = await supabase
        .from("projects")
        .insert({
          owner: user.id,
          name: name.trim(),
          brief: brief.trim() || null,
          status: "em_andamento",
          stage: "roteiro",
          video_path: path,
          format: aspect,
          folder: folder.trim() || "Geral",
          briefing: hasBriefing ? cleanBriefing : null,
          campaign: campaignValue,
          aspect,
        })
        .select("id")
        .single<{ id: string }>();

      if (insertError || !project) {
        setError("Não foi possível criar o projeto.");
        setStep("idle");
        return;
      }

      router.push(`/projetos/${project.id}`);
      router.refresh();
    } catch {
      setError("Erro inesperado. Tente novamente.");
      setStep("idle");
    }
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <span className="text-base leading-none">+</span> Novo projeto
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-project-title"
        >
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={close}
          />
          <div
            ref={dialogRef}
            className="relative z-10 max-h-[90vh] w-full max-w-lg animate-fade-in overflow-y-auto scroll-thin rounded-2xl border border-black/[0.06] bg-white p-6 shadow-soft-lg"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="new-project-title" className="text-lg font-bold text-ink">
                  Novo projeto
                </h2>
                <p className="mt-1 text-sm text-muted-fg">
                  Suba o vídeo base, organize em uma pasta e descreva o
                  briefing. A squad assume a partir daí.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="btn-ghost -mr-2 -mt-1"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="np-name">
                  Nome do projeto
                </label>
                <input
                  id="np-name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Lançamento Coleção Verão"
                  disabled={busy}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="np-folder">
                    Pasta
                  </label>
                  <input
                    id="np-folder"
                    className="input"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    placeholder="Geral"
                    list="np-folder-list"
                    disabled={busy}
                  />
                  <datalist id="np-folder-list">
                    {folders.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="label" htmlFor="np-campaign">
                    Campanha
                  </label>
                  <select
                    id="np-campaign"
                    className="input"
                    value={campaign}
                    onChange={(e) =>
                      setCampaign(e.target.value as CampaignChoice)
                    }
                    disabled={busy}
                  >
                    {CAMPAIGN_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <fieldset className="rounded-xl border border-black/[0.08] p-4">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-fg">
                  Briefing
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <BriefField
                    id="bf-objetivo"
                    label="Objetivo"
                    value={briefing.objetivo ?? ""}
                    onChange={(v) => setB("objetivo", v)}
                    placeholder="Ex.: gerar leads"
                    disabled={busy}
                  />
                  <BriefField
                    id="bf-publico"
                    label="Público"
                    value={briefing.publico ?? ""}
                    onChange={(v) => setB("publico", v)}
                    placeholder="Ex.: mulheres 25–40"
                    disabled={busy}
                  />
                  <BriefField
                    id="bf-oferta"
                    label="Oferta"
                    value={briefing.oferta ?? ""}
                    onChange={(v) => setB("oferta", v)}
                    placeholder="Ex.: 30% off"
                    disabled={busy}
                  />
                  <BriefField
                    id="bf-cta"
                    label="CTA"
                    value={briefing.cta ?? ""}
                    onChange={(v) => setB("cta", v)}
                    placeholder="Ex.: Compre agora"
                    disabled={busy}
                  />
                </div>
                <div className="mt-3">
                  <label className="label" htmlFor="bf-obs">
                    Observações
                  </label>
                  <textarea
                    id="bf-obs"
                    className="input min-h-[64px] resize-y"
                    value={briefing.observacoes ?? ""}
                    onChange={(e) => setB("observacoes", e.target.value)}
                    placeholder="Tom, referências, restrições…"
                    disabled={busy}
                  />
                </div>
              </fieldset>

              <div>
                <label className="label" htmlFor="np-brief">
                  Resumo livre (opcional)
                </label>
                <textarea
                  id="np-brief"
                  className="input min-h-[72px] resize-y"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Descreva em uma frase o que a squad deve entregar…"
                  disabled={busy}
                />
              </div>

              <div>
                <label className="label" htmlFor="np-file">
                  Vídeo base
                </label>
                <input
                  id="np-file"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={busy}
                  className="block w-full cursor-pointer rounded-xl border border-dashed border-black/15 bg-surface-muted px-3.5 py-3 text-sm text-muted-fg file:mr-3 file:rounded-lg file:border-0 file:bg-brand-gradient file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:border-brand-blue/40"
                />
                {file && (
                  <p className="mt-1.5 truncate text-xs text-muted-fg">
                    {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={busy} className="btn-primary">
                  {step === "uploading"
                    ? "Enviando vídeo…"
                    : step === "saving"
                    ? "Criando projeto…"
                    : "Criar projeto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function BriefField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}
