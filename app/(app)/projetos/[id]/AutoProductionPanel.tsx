"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RenderBadge } from "@/components/StatusBadge";
import { CancelJobButton } from "@/components/CancelJobButton";
import type { RenderJob } from "@/lib/types";

interface Props {
  job: RenderJob | null;
  renderUrl: string | null;
  aspect: string;
}

const AUTO_STEPS = [
  { emoji: "🎬", label: "Roteiro" },
  { emoji: "🎨", label: "Imagem" },
  { emoji: "⬜", label: "Legenda" },
  { emoji: "✂️", label: "Montagem" },
  { emoji: "🎞️", label: "Render" },
];

/** Resolves an output item to a browser URL (full URLs pass through; storage paths → public URL do bucket 'renders'). */
function toPublicUrl(item: string): string {
  if (/^https?:\/\//i.test(item)) return item;
  return createClient().storage.from("renders").getPublicUrl(item).data.publicUrl;
}

/**
 * Parses the carrossel output_path, which the worker may deliver as:
 * - um JSON array de URLs ("[...]")
 * - um caminho/URL .zip com todas as artes
 * - uma lista separada por vírgula
 * - um item único
 */
function parseCarrosselOutput(raw: string): { zipUrl: string | null; images: string[] } {
  const output = raw.trim();
  if (!output) return { zipUrl: null, images: [] };

  if (output.toLowerCase().endsWith(".zip")) {
    return { zipUrl: toPublicUrl(output), images: [] };
  }

  if (output.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(output);
      if (Array.isArray(parsed)) {
        return {
          zipUrl: null,
          images: parsed
            .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
            .map((u) => toPublicUrl(u.trim())),
        };
      }
    } catch {
      // JSON malformado — cai para os formatos abaixo.
    }
  }

  return {
    zipUrl: null,
    images: output
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(toPublicUrl),
  };
}

/**
 * Right-pane panel for auto-mode (Gerador) projects: replaces the chat
 * approval flow with a "Produção automática" banner, live job status/progress
 * and the final video + download once the render lands.
 */
export function AutoProductionPanel({ job, renderUrl, aspect }: Props) {
  const router = useRouter();
  const inProgress =
    !!job &&
    (job.status === "queued" ||
      job.status === "claimed" ||
      job.status === "running");

  // Poll while the worker is processing.
  useEffect(() => {
    if (!inProgress) return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [inProgress, router]);

  const progress = Math.max(0, Math.min(100, job?.progress ?? 0));
  const done = job?.status === "done";
  const failed = job?.status === "error";
  const isVertical = !aspect.includes("16:9") || aspect.includes("9:16");

  const spec = (job?.spec ?? null) as { videoType?: string } | null;
  const isCarrossel = spec?.videoType === "carrossel";

  // Carrossel: output_path pode ser JSON array de URLs, .zip ou lista separada por vírgula.
  const carrossel = useMemo(
    () =>
      isCarrossel && done && job?.output_path
        ? parseCarrosselOutput(job.output_path)
        : { zipUrl: null, images: [] as string[] },
    [isCarrossel, done, job?.output_path]
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto scroll-thin bg-white px-6 py-6 sm:px-8">
      {/* Banner */}
      <div className="rounded-2xl bg-brand-gradient p-[1.5px] shadow-soft">
        <div className="rounded-[calc(1rem-1.5px)] bg-white px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="gradient-text text-xs font-bold uppercase tracking-widest">
                ✦ Produção automática
              </p>
              <p className="mt-1 text-sm text-ink/80">
                A squad está produzindo {isCarrossel ? "este carrossel" : "este vídeo"}{" "}
                de ponta a ponta — sem aprovações manuais.
              </p>
            </div>
            {job && <RenderBadge status={job.status} />}
          </div>
        </div>
      </div>

      {/* Pipeline steps (all automatic) */}
      <div className="mt-5 grid grid-cols-5 gap-2">
        {AUTO_STEPS.map((s, i) => {
          const active =
            inProgress &&
            (job?.status === "running"
              ? i === Math.min(4, Math.floor((progress / 100) * 5))
              : i === 0);
          return (
            <div
              key={s.label}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center ${
                done
                  ? "border-emerald-200 bg-emerald-50"
                  : active
                  ? "border-brand-blue/30 bg-brand-blue/[0.06]"
                  : "border-black/[0.06] bg-surface-muted"
              }`}
            >
              <span className="text-base" aria-hidden>
                {s.emoji}
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  done
                    ? "text-emerald-700"
                    : active
                    ? "text-brand-blue"
                    : "text-muted-fg"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status detail */}
      {!job && (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Nenhum job de produção encontrado para este projeto.
        </p>
      )}

      {inProgress && job && (
        <div className="card mt-5 p-5">
          <div className="flex items-center justify-between">
            <p className="label !mb-0">Progresso</p>
            <span className="text-sm font-bold text-ink">{progress}%</span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all duration-500"
              style={{ width: `${progress > 0 ? progress : 8}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-fg">
            {job.status === "queued"
              ? "Na fila — o worker assume em instantes."
              : job.status === "claimed"
              ? "Reservado pelo worker — a produção começa agora."
              : "Processando roteiro, visual, legenda e montagem automaticamente…"}
          </p>
          <div className="mt-4 flex justify-end border-t border-black/[0.06] pt-3">
            <CancelJobButton jobId={job.id} projectId={job.project_id} />
          </div>
        </div>
      )}

      {failed && job && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-700">
            Falha na produção
          </p>
          <p className="mt-1 text-xs text-red-700/90">
            {job.error || "O worker encontrou um erro. Tente gerar novamente."}
          </p>
        </div>
      )}

      {done && isCarrossel && carrossel.zipUrl && (
        <div className="mt-5 space-y-4">
          <p className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-center text-xs font-medium text-emerald-700">
            Carrossel pronto 🎉 — as 10 artes estão no pacote abaixo.
          </p>
          <a
            href={carrossel.zipUrl}
            download
            className="btn-primary w-full"
            target="_blank"
            rel="noopener noreferrer"
          >
            ⬇ Baixar carrossel (.zip)
          </a>
        </div>
      )}

      {done && isCarrossel && !carrossel.zipUrl && carrossel.images.length > 0 && (
        <div className="mt-5 space-y-4">
          <p className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-center text-xs font-medium text-emerald-700">
            Carrossel pronto 🎉 — {carrossel.images.length}{" "}
            {carrossel.images.length === 1 ? "arte" : "artes"} em 4:5 abaixo.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {carrossel.images.map((src, i) => (
              <a
                key={`${src}-${i}`}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-xl border border-black/[0.08] bg-surface-muted shadow-soft"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Arte ${i + 1} do carrossel`}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover transition-transform group-hover:scale-[1.03]"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {done && !isCarrossel && renderUrl && (
        <div className="mt-5 space-y-4">
          <p className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-center text-xs font-medium text-emerald-700">
            Vídeo pronto 🎉 — assista abaixo ou baixe o arquivo final.
          </p>
          <div className="overflow-hidden rounded-2xl bg-black shadow-soft-lg">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={renderUrl}
              controls
              playsInline
              className={`w-full object-contain ${
                isVertical ? "aspect-[9/16] max-h-[520px]" : "aspect-video"
              }`}
            />
          </div>
          <a
            href={renderUrl}
            download
            className="btn-primary w-full"
            target="_blank"
            rel="noopener noreferrer"
          >
            ⬇ Baixar vídeo final
          </a>
        </div>
      )}

      {done &&
        ((isCarrossel && !carrossel.zipUrl && carrossel.images.length === 0) ||
          (!isCarrossel && !renderUrl)) && (
          <p className="mt-5 text-sm text-muted-fg">
            Produção concluída, mas o arquivo ainda não está disponível.
            Atualize a página em instantes.
          </p>
        )}
    </div>
  );
}
