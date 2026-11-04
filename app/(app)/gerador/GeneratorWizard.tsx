"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CAMPAIGN_TOGGLE,
  TONE_OPTIONS,
  VIDEO_TYPES,
  VIDEO_TYPE_ASPECT,
  VIDEO_TYPE_ORDER,
  toneLabel,
} from "@/lib/generator";
import { CAMPAIGNS } from "@/lib/flow";
import type { Brand, Briefing, Campaign, VideoType } from "@/lib/types";

const DEFAULT_PRIMARY = "#0F3D2E";
const DEFAULT_ACCENT = "#FF7A00";

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS: { step: WizardStep; label: string }[] = [
  { step: 1, label: "Marca" },
  { step: 2, label: "Tipo" },
  { step: 3, label: "Briefing" },
  { step: 4, label: "Confirmar" },
];

interface BriefingForm {
  objetivo: string;
  oferta: string;
  cta: string;
  tom: string;
  observacoes: string;
}

export function GeneratorWizard({ brands }: { brands: Brand[] }) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [videoType, setVideoType] = useState<VideoType | null>(null);
  const [campaign, setCampaign] = useState<Campaign>("meta");
  const [briefing, setBriefing] = useState<BriefingForm>({
    objetivo: "",
    oferta: "",
    cta: "",
    tom: "comercial",
    observacoes: "",
  });
  const [legendado, setLegendado] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState<"idle" | "uploading" | "creating">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const brand = useMemo(
    () => brands.find((b) => b.id === brandId) ?? null,
    [brands, brandId]
  );
  const busy = submitting !== "idle";
  // Presets com aspect fixo (carrossel 4:5, google_ads 16:9) sobrepõem a campanha.
  const aspect =
    (videoType ? VIDEO_TYPE_ASPECT[videoType] : undefined) ??
    CAMPAIGNS[campaign].aspect;
  // Carrossel é estático para Instagram — o toggle de campanha não se aplica.
  const hideCampaign = videoType === "carrossel";

  function setB(key: keyof BriefingForm, value: string) {
    setBriefing((b) => ({ ...b, [key]: value }));
  }

  function goNext() {
    setError(null);
    if (step === 1 && !brand) {
      setError("Selecione uma marca para continuar.");
      return;
    }
    if (step === 2 && !videoType) {
      setError("Escolha o tipo de vídeo.");
      return;
    }
    if (step === 3 && !briefing.objetivo.trim()) {
      setError("Descreva o objetivo do vídeo.");
      return;
    }
    setStep((s) => (s < 4 ? ((s + 1) as WizardStep) : s));
  }

  function goBack() {
    if (busy) return;
    setError(null);
    setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));
  }

  async function handleSubmit() {
    if (busy || !brand || !videoType) return;
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sessão expirada. Faça login novamente.");
      return;
    }

    try {
      // Optional source video (Íntegra) → private 'videos' bucket.
      let videoPath: string | null = null;
      if (file && videoType === "integra") {
        setSubmitting("uploading");
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
          setError("Falha no upload do vídeo base. Tente novamente.");
          setSubmitting("idle");
          return;
        }
        videoPath = path;
      }

      setSubmitting("creating");

      // Only persist filled briefing fields.
      const cleanBriefing: Briefing = { tom: briefing.tom };
      if (briefing.objetivo.trim()) cleanBriefing.objetivo = briefing.objetivo.trim();
      if (briefing.oferta.trim()) cleanBriefing.oferta = briefing.oferta.trim();
      if (briefing.cta.trim()) cleanBriefing.cta = briefing.cta.trim();
      if (briefing.observacoes.trim())
        cleanBriefing.observacoes = briefing.observacoes.trim();

      const dateStr = new Date().toLocaleDateString("pt-BR");
      const projectName = `${brand.name} — ${VIDEO_TYPES[videoType].label} ${dateStr}`;

      // Carrossel não pertence a uma campanha de vídeo.
      const effectiveCampaign: Campaign | null =
        videoType === "carrossel" ? null : campaign;

      const { data: project, error: insertError } = await supabase
        .from("projects")
        .insert({
          owner: user.id,
          name: projectName,
          brief: null,
          status: "renderizando",
          stage: "render",
          video_path: videoPath,
          format: aspect,
          folder: "Gerador",
          briefing: cleanBriefing,
          campaign: effectiveCampaign,
          aspect,
          brand_id: brand.id,
        })
        .select("id")
        .single<{ id: string }>();

      if (insertError || !project) {
        setError("Não foi possível criar o projeto.");
        setSubmitting("idle");
        return;
      }

      const { error: jobError } = await supabase.from("render_jobs").insert({
        project_id: project.id,
        status: "queued",
        progress: 0,
        spec: {
          mode: "auto",
          videoType,
          aspect,
          campaign: effectiveCampaign,
          legendado: videoType === "propaganda" ? legendado : false,
          brand: {
            name: brand.name,
            colors: {
              primary: brand.color_primary ?? DEFAULT_PRIMARY,
              accent: brand.color_accent ?? DEFAULT_ACCENT,
            },
            logo_path: brand.logo_path,
            phone: brand.phone,
            whatsapp: brand.whatsapp,
            address: brand.address,
            tagline: brand.tagline,
          },
          briefing: cleanBriefing,
          source_video_path: videoPath,
        },
      });

      if (jobError) {
        await supabase
          .from("projects")
          .update({ status: "erro" })
          .eq("id", project.id);
        setError("Projeto criado, mas falhou ao enfileirar a produção.");
        setSubmitting("idle");
        return;
      }

      router.push(`/projetos/${project.id}`);
      router.refresh();
    } catch {
      setError("Erro inesperado. Tente novamente.");
      setSubmitting("idle");
    }
  }

  return (
    <div>
      {/* Stepper */}
      <ol className="flex items-center gap-2" aria-label="Etapas do gerador">
        {STEP_LABELS.map(({ step: s, label }, i) => {
          const isCurrent = s === step;
          const isDone = s < step;
          return (
            <li key={s} className="flex flex-1 items-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isCurrent
                    ? "border-transparent bg-brand-gradient text-white shadow-soft"
                    : isDone
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-black/10 bg-white text-muted-fg"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    isCurrent
                      ? "bg-white/20"
                      : isDone
                      ? "bg-emerald-600 text-white"
                      : "bg-black/[0.06]"
                  }`}
                >
                  {isDone ? "✓" : s}
                </span>
                {label}
              </div>
              {i < STEP_LABELS.length - 1 && (
                <span className="hidden h-px flex-1 bg-black/10 sm:block" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      <div className="card mt-6 p-6 sm:p-8">
        {/* Step 1 — Marca */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold text-ink">Escolha a marca</h2>
            <p className="mt-1 text-sm text-muted-fg">
              O vídeo sai com o logo, as cores e o contato do kit selecionado.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {brands.map((b) => {
                const selected = b.id === brandId;
                const primary = b.color_primary ?? DEFAULT_PRIMARY;
                const accent = b.color_accent ?? DEFAULT_ACCENT;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBrandId(b.id)}
                    aria-pressed={selected}
                    className={`overflow-hidden rounded-2xl border text-left transition-all ${
                      selected
                        ? "border-brand-blue/50 shadow-soft-lg ring-4 ring-brand-blue/10"
                        : "border-black/[0.08] hover:border-brand-blue/30 hover:shadow-soft"
                    }`}
                  >
                    <div
                      className="flex h-16 items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${primary} 0%, ${accent} 140%)`,
                      }}
                    >
                      {b.logo_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.logo_path}
                          alt=""
                          className="max-h-11 max-w-[65%] rounded-md bg-white/85 object-contain p-1"
                        />
                      ) : (
                        <span className="text-lg font-extrabold text-white/90">
                          {b.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-white px-3.5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {b.name}
                        </p>
                        {b.tagline && (
                          <p className="truncate text-xs text-muted-fg">
                            {b.tagline}
                          </p>
                        )}
                      </div>
                      <span className="flex shrink-0 gap-1" aria-hidden>
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/10"
                          style={{ backgroundColor: primary }}
                        />
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/10"
                          style={{ backgroundColor: accent }}
                        />
                      </span>
                    </div>
                  </button>
                );
              })}

              <Link
                href="/marcas"
                className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 bg-surface-muted text-center transition-colors hover:border-brand-blue/40 hover:text-brand-blue"
              >
                <span className="text-xl leading-none" aria-hidden>
                  +
                </span>
                <span className="px-4 text-sm font-medium">
                  Criar nova marca
                </span>
              </Link>
            </div>
          </div>
        )}

        {/* Step 2 — Tipo */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold text-ink">Preset de produção</h2>
            <p className="mt-1 text-sm text-muted-fg">
              Cada preset tem duração, formato e linguagem próprios.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {VIDEO_TYPE_ORDER.map((key) => {
                const t = VIDEO_TYPES[key];
                const selected = key === videoType;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setVideoType(key);
                      // Google Ads é sempre horizontal — alinha a campanha.
                      if (key === "google_ads") setCampaign("google");
                    }}
                    aria-pressed={selected}
                    className={`flex flex-col rounded-2xl border p-5 text-left transition-all ${
                      selected
                        ? "border-brand-blue/50 bg-brand-blue/[0.04] shadow-soft-lg ring-4 ring-brand-blue/10"
                        : "border-black/[0.08] bg-white hover:border-brand-blue/30 hover:shadow-soft"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-2xl" aria-hidden>
                        {t.emoji}
                      </span>
                      {t.badge && (
                        <span className="rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          {t.badge}
                        </span>
                      )}
                    </span>
                    <span className="mt-3 text-sm font-bold text-ink">
                      {t.label}
                    </span>
                    <span className="mt-0.5 text-xs font-medium text-brand-blue">
                      {t.tagline}
                    </span>
                    <span className="mt-0.5 text-xs text-muted-fg">
                      {t.duration}
                    </span>
                    <ul className="mt-3 space-y-1">
                      {t.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-1.5 text-xs text-muted-fg"
                        >
                          <span className="mt-0.5 text-emerald-600" aria-hidden>
                            ✓
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {!hideCampaign && (
              <div className="mt-6">
                <p className="label">Campanha</p>
                <div
                  className="inline-flex rounded-2xl border border-black/10 bg-surface-muted p-1"
                  role="group"
                  aria-label="Campanha de destino"
                >
                  {CAMPAIGN_TOGGLE.map((opt) => {
                    const selected = campaign === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCampaign(opt.value)}
                        aria-pressed={selected}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                          selected
                            ? "bg-brand-gradient text-white shadow-soft"
                            : "text-muted-fg hover:text-ink"
                        }`}
                      >
                        {opt.label}
                        <span
                          className={`ml-1.5 text-xs font-medium ${
                            selected ? "text-white/70" : "text-muted-fg/60"
                          }`}
                        >
                          {opt.aspect}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {hideCampaign && (
              <p className="mt-6 rounded-xl border border-black/[0.06] bg-surface-muted px-4 py-3 text-sm text-muted-fg">
                🖼️ Carrossel é entregue como 10 artes estáticas 4:5 para
                Instagram — não precisa de campanha de vídeo.
              </p>
            )}
          </div>
        )}

        {/* Step 3 — Briefing */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold text-ink">Briefing</h2>
            <p className="mt-1 text-sm text-muted-fg">
              Quanto mais claro o objetivo, melhor o resultado.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="gw-objetivo">
                  Objetivo
                </label>
                <input
                  id="gw-objetivo"
                  className="input"
                  value={briefing.objetivo}
                  onChange={(e) => setB("objetivo", e.target.value)}
                  placeholder="Ex.: gerar leads para o plano mensal"
                  disabled={busy}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="gw-oferta">
                    Oferta / serviço em destaque
                  </label>
                  <input
                    id="gw-oferta"
                    className="input"
                    value={briefing.oferta}
                    onChange={(e) => setB("oferta", e.target.value)}
                    placeholder="Ex.: consulta com 30% off"
                    disabled={busy}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="gw-cta">
                    CTA desejado
                  </label>
                  <input
                    id="gw-cta"
                    className="input"
                    value={briefing.cta}
                    onChange={(e) => setB("cta", e.target.value)}
                    placeholder="Ex.: Chame no WhatsApp"
                    disabled={busy}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="gw-tom">
                  Tom
                </label>
                <select
                  id="gw-tom"
                  className="input"
                  value={briefing.tom}
                  onChange={(e) => setB("tom", e.target.value)}
                  disabled={busy}
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {videoType === "propaganda" && (
                <label
                  htmlFor="gw-legendado"
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-black/[0.08] bg-surface-muted px-4 py-3"
                >
                  <input
                    id="gw-legendado"
                    type="checkbox"
                    checked={legendado}
                    onChange={(e) => setLegendado(e.target.checked)}
                    disabled={busy}
                    className="h-4 w-4 accent-current"
                  />
                  <span className="text-sm font-medium text-ink">
                    Legendado
                    <span className="ml-1.5 text-xs font-normal text-muted-fg">
                      legenda queimada no vídeo final
                    </span>
                  </span>
                </label>
              )}

              <div>
                <label className="label" htmlFor="gw-obs">
                  Observações
                </label>
                <textarea
                  id="gw-obs"
                  className="input min-h-[72px] resize-y"
                  value={briefing.observacoes}
                  onChange={(e) => setB("observacoes", e.target.value)}
                  placeholder="Referências, restrições, detalhes da marca…"
                  disabled={busy}
                />
              </div>

              {videoType === "integra" && (
                <div>
                  <label className="label" htmlFor="gw-file">
                    Vídeo base (opcional)
                  </label>
                  <input
                    id="gw-file"
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
              )}
            </div>
          </div>
        )}

        {/* Step 4 — Confirmar */}
        {step === 4 && brand && videoType && (
          <div>
            <h2 className="text-lg font-bold text-ink">Confirme e gere</h2>
            <p className="mt-1 text-sm text-muted-fg">
              Revise o resumo — ao confirmar, a produção entra na fila
              automaticamente.
            </p>

            <dl className="mt-5 space-y-3">
              <SummaryRow label="Marca">
                <span className="flex items-center gap-2">
                  <span className="flex gap-1" aria-hidden>
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/10"
                      style={{
                        backgroundColor: brand.color_primary ?? DEFAULT_PRIMARY,
                      }}
                    />
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/10"
                      style={{
                        backgroundColor: brand.color_accent ?? DEFAULT_ACCENT,
                      }}
                    />
                  </span>
                  {brand.name}
                </span>
              </SummaryRow>
              <SummaryRow label="Preset">
                {VIDEO_TYPES[videoType].emoji} {VIDEO_TYPES[videoType].label}
                {VIDEO_TYPES[videoType].badge
                  ? ` (${VIDEO_TYPES[videoType].badge})`
                  : ""}{" "}
                · {VIDEO_TYPES[videoType].tagline}
              </SummaryRow>
              {videoType === "carrossel" ? (
                <SummaryRow label="Formato">
                  10 artes estáticas 4:5 — Instagram
                </SummaryRow>
              ) : (
                <SummaryRow label="Campanha">
                  {CAMPAIGNS[campaign].label} — entrega em {aspect}
                </SummaryRow>
              )}
              {videoType === "propaganda" && (
                <SummaryRow label="Legendado">
                  {legendado ? "Sim — legenda queimada" : "Não"}
                </SummaryRow>
              )}
              <SummaryRow label="Objetivo">
                {briefing.objetivo.trim() || "—"}
              </SummaryRow>
              {briefing.oferta.trim() && (
                <SummaryRow label="Oferta">{briefing.oferta.trim()}</SummaryRow>
              )}
              {briefing.cta.trim() && (
                <SummaryRow label="CTA">{briefing.cta.trim()}</SummaryRow>
              )}
              <SummaryRow label="Tom">{toneLabel(briefing.tom)}</SummaryRow>
              {briefing.observacoes.trim() && (
                <SummaryRow label="Observações">
                  {briefing.observacoes.trim()}
                </SummaryRow>
              )}
              {videoType === "integra" && (
                <SummaryRow label="Vídeo base">
                  {file ? file.name : "Nenhum — produção 100% gerada"}
                </SummaryRow>
              )}
            </dl>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-black/[0.06] pt-5">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={busy}
              className="btn-secondary"
            >
              ← Voltar
            </button>
          ) : (
            <span />
          )}

          {step < 4 ? (
            <button type="button" onClick={goNext} className="btn-primary">
              Continuar →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="btn-primary"
            >
              {submitting === "uploading"
                ? "Enviando vídeo…"
                : submitting === "creating"
                ? "Enfileirando produção…"
                : "✦ Gerar vídeo"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
        {label}
      </dt>
      <dd className="text-sm font-medium text-ink sm:text-right">{children}</dd>
    </div>
  );
}
