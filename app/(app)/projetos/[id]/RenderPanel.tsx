"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RenderBadge } from "@/components/StatusBadge";
import type { RenderJob } from "@/lib/types";

interface Props {
  projectId: string;
  job: RenderJob;
  renderUrl: string | null;
}

export function RenderPanel({ job, renderUrl }: Props) {
  const router = useRouter();
  const inProgress =
    job.status === "queued" ||
    job.status === "claimed" ||
    job.status === "running";

  // Poll for status while the worker is processing.
  useEffect(() => {
    if (!inProgress) return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [inProgress, router]);

  const progress = Math.max(0, Math.min(100, job.progress ?? 0));

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="label !mb-0">Render final</p>
        <RenderBadge status={job.status} />
      </div>

      {inProgress && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all duration-500"
              style={{ width: `${progress > 0 ? progress : 8}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-fg">
            {job.status === "queued"
              ? "Na fila — aguardando o worker."
              : job.status === "claimed"
              ? "Reservado pelo worker."
              : `Processando… ${progress}%`}
          </p>
        </div>
      )}

      {job.status === "error" && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {job.error || "Falha no render. Verifique o worker."}
        </p>
      )}

      {job.status === "done" && renderUrl && (
        <div className="mt-3 space-y-3">
          <div className="overflow-hidden rounded-xl bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={renderUrl}
              controls
              playsInline
              className="aspect-[9/16] max-h-[360px] w-full object-contain"
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

      {job.status === "done" && !renderUrl && (
        <p className="mt-3 text-xs text-muted-fg">
          Render concluído, mas o arquivo ainda não está disponível.
        </p>
      )}
    </div>
  );
}
