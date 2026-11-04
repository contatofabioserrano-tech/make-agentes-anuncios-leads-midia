import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { STAGES, stageLabel } from "@/lib/flow";
import { StatusBadge, CampaignBadge } from "@/components/StatusBadge";
import type { Edit, Message, Project, RenderJob, StageKey } from "@/lib/types";
import { ProjectChat } from "./ProjectChat";
import { RenderPanel } from "./RenderPanel";
import { AutoProductionPanel } from "./AutoProductionPanel";
import { BriefingCard } from "./BriefingCard";
import { EditsSection } from "./EditsSection";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: { id: string };
}) {
  await requireSession();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<Project>();

  if (!project) notFound();

  const [{ data: messages }, { data: renderJob }, { data: edits }] =
    await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: true })
        .returns<Message[]>(),
      supabase
        .from("render_jobs")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<RenderJob>(),
      supabase
        .from("edits")
        .select("*")
        .eq("project_id", project.id)
        .order("stage", { ascending: true })
        .order("version", { ascending: true })
        .returns<Edit[]>(),
    ]);

  // Signed URL for the private source video.
  let videoUrl: string | null = null;
  if (project.video_path) {
    const { data: signed } = await supabase.storage
      .from("videos")
      .createSignedUrl(project.video_path, 60 * 60);
    videoUrl = signed?.signedUrl ?? null;
  }

  // Public URL for the finished render, if any.
  let renderUrl: string | null = null;
  if (renderJob?.status === "done" && renderJob.output_path) {
    const { data: pub } = supabase.storage
      .from("renders")
      .getPublicUrl(renderJob.output_path);
    renderUrl = pub.publicUrl;
  }

  const currentStage = project.stage as StageKey;

  // Auto-mode (Gerador): the render job runs end-to-end without approvals.
  const jobSpec = (renderJob?.spec ?? null) as { mode?: string } | null;
  const isAutoProduction =
    currentStage === "render" &&
    (jobSpec?.mode === "auto" || project.folder === "Gerador");

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-screen">
      {/* Top bar */}
      <header className="border-b border-black/[0.06] bg-white px-6 py-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/projetos"
              className="text-xs font-medium text-muted-fg hover:text-ink"
            >
              ← Projetos
            </Link>
            <h1 className="mt-0.5 truncate text-xl font-extrabold tracking-tight text-ink">
              {project.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-black/10 bg-surface-muted text-muted-fg">
              📁 {project.folder || "Geral"}
            </span>
            <CampaignBadge campaign={project.campaign} />
            <span className="chip border-black/10 bg-surface-muted text-muted-fg">
              {project.aspect || project.format}
            </span>
            <StatusBadge status={project.status} />
          </div>
        </div>
      </header>

      {/* Two-pane */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,40%)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[420px_1fr] lg:grid-rows-1">
        {/* Left: preview + meta + squad */}
        <div className="overflow-y-auto scroll-thin border-b border-black/[0.06] bg-surface-muted p-6 lg:border-b-0 lg:border-r">
          <div className="card-dark overflow-hidden">
            <div className="relative aspect-[9/16] max-h-[420px] w-full bg-black">
              {videoUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-white/40">
                  Sem vídeo base
                </div>
              )}
            </div>
          </div>

          <BriefingCard projectId={project.id} briefing={project.briefing} />

          {project.brief && (
            <div className="mt-5 card p-4">
              <p className="label">Resumo livre</p>
              <p className="text-sm text-ink/80">{project.brief}</p>
            </div>
          )}

          {/* Squad chips */}
          <div className="mt-5">
            <p className="label">Squad</p>
            <ul className="space-y-2">
              {STAGES.map((agent) => {
                const isCurrent = agent.key === currentStage;
                const order = STAGES.findIndex((s) => s.key === agent.key);
                const currentOrder = STAGES.findIndex(
                  (s) => s.key === currentStage
                );
                const done =
                  currentStage === "render" ||
                  currentStage === "done" ||
                  order < currentOrder;
                return (
                  <li
                    key={agent.key}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                      isCurrent
                        ? "border-brand-blue/30 bg-white shadow-soft"
                        : "border-black/[0.06] bg-white/60"
                    }`}
                  >
                    <span className="text-lg">{agent.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {agent.agent}
                      </p>
                      <p className="truncate text-xs text-muted-fg">
                        {agent.role}
                      </p>
                    </div>
                    {done ? (
                      <span className="text-xs font-semibold text-emerald-600">
                        ✓
                      </span>
                    ) : isCurrent ? (
                      <span className="chip border-brand-blue/30 bg-brand-blue/10 text-brand-blue">
                        Ativo
                      </span>
                    ) : (
                      <span className="text-xs text-muted-fg/60">
                        {stageLabel(agent.key)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Render panel (status / progress / download) */}
          {renderJob && (
            <div className="mt-5">
              <RenderPanel
                projectId={project.id}
                job={renderJob}
                renderUrl={renderUrl}
              />
            </div>
          )}

          {/* Versioned edits + collective export */}
          <div className="mt-5">
            <EditsSection projectId={project.id} edits={edits ?? []} />
          </div>
        </div>

        {/* Right: auto-production panel (Gerador) or agentic chat */}
        {isAutoProduction ? (
          <AutoProductionPanel
            job={renderJob ?? null}
            renderUrl={renderUrl}
            aspect={project.aspect || project.format}
          />
        ) : (
          <ProjectChat
            projectId={project.id}
            initialMessages={messages ?? []}
            currentStage={currentStage}
          />
        )}
      </div>
    </div>
  );
}
