"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  agentForStage,
  nextStage,
  stageLabel,
  STAGE_BY_KEY,
} from "@/lib/flow";
import type { Briefing, Project, StageKey } from "@/lib/types";

interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Loads a project the current user is allowed to touch (RLS enforced). */
async function loadProject(supabase: ReturnType<typeof createClient>, projectId: string) {
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle<Project>();
  return data;
}

/**
 * Persists an approved stage as a versioned `edits` row ("edições salvas
 * individualmente"). Version = count of prior edits for that stage + 1.
 */
async function recordEdit(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  stage: string,
  payload: Record<string, unknown>
) {
  const { count } = await supabase
    .from("edits")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("stage", stage);

  await supabase.from("edits").insert({
    project_id: projectId,
    stage,
    version: (count ?? 0) + 1,
    payload,
    approved: true,
  });
}

/** Posts the current squad-stage agent's delivery + approval_request. */
async function postStageDelivery(
  supabase: ReturnType<typeof createClient>,
  project: Project,
  feedback?: string
) {
  const stage = project.stage as StageKey;
  const agent = agentForStage(stage);
  if (!agent) return;

  const next = nextStage(stage);
  const nextLabel = next ? stageLabel(next) : "render final";

  let deliveryText = agent.deliveryTemplate(project.brief ?? "");
  if (feedback && feedback.trim()) {
    deliveryText = `Ajustei conforme seu pedido ("${feedback.trim()}"). ${deliveryText}`;
  }

  await supabase.from("messages").insert([
    {
      project_id: project.id,
      role: "agent",
      agent: agent.agent,
      emoji: agent.emoji,
      stage,
      kind: "delivery",
      text: deliveryText,
      meta: { role_desc: agent.role },
    },
    {
      project_id: project.id,
      role: "agent",
      agent: agent.agent,
      emoji: agent.emoji,
      stage,
      kind: "approval_request",
      text:
        agent.key === "montagem"
          ? "Aprovou? Posso enfileirar o render final?"
          : `Aprovou? Posso seguir para ${nextLabel}?`,
      meta: { next_stage: next },
    },
  ]);
}

/**
 * Ensures the conversation has been kicked off. If there are no messages yet,
 * the current-stage agent posts its first delivery + approval_request.
 */
export async function ensureKickoff(projectId: string): Promise<ActionResult> {
  const supabase = createClient();
  const project = await loadProject(supabase, projectId);
  if (!project) return { ok: false, error: "Projeto não encontrado." };

  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if ((count ?? 0) === 0 && STAGE_BY_KEY[project.stage]) {
    await postStageDelivery(supabase, project);
    revalidatePath(`/projetos/${projectId}`);
  }
  return { ok: true };
}

/** Free-form user message → re-trigger the current stage agent. */
export async function sendUserMessage(
  projectId: string,
  text: string
): Promise<ActionResult> {
  const supabase = createClient();
  const clean = text.trim();
  if (!clean) return { ok: false, error: "Mensagem vazia." };

  const project = await loadProject(supabase, projectId);
  if (!project) return { ok: false, error: "Projeto não encontrado." };

  await supabase.from("messages").insert({
    project_id: projectId,
    role: "user",
    kind: "chat",
    stage: project.stage,
    text: clean,
  });

  // If we're still inside the squad, the current agent responds again.
  if (STAGE_BY_KEY[project.stage]) {
    await postStageDelivery(supabase, project, clean);
  }

  revalidatePath(`/projetos/${projectId}`);
  return { ok: true };
}

/**
 * User approves the current stage. Advances the pipeline; the next agent posts
 * its delivery. When the last squad stage (montagem) is approved, enqueue render.
 */
export async function approveStage(projectId: string): Promise<ActionResult> {
  const supabase = createClient();
  const project = await loadProject(supabase, projectId);
  if (!project) return { ok: false, error: "Projeto não encontrado." };

  const currentStage = project.stage as StageKey;
  const agent = agentForStage(currentStage);
  if (!agent) return { ok: false, error: "Etapa não aprovável." };

  // Record the approval.
  await supabase.from("messages").insert({
    project_id: projectId,
    role: "user",
    kind: "approval_response",
    stage: currentStage,
    text: `Aprovado: ${agent.label}.`,
    meta: { decision: "approve" },
  });

  // Persist the approved stage as a versioned edit ("edições salvas individualmente").
  const { data: lastDelivery } = await supabase
    .from("messages")
    .select("text")
    .eq("project_id", projectId)
    .eq("stage", currentStage)
    .eq("kind", "delivery")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ text: string | null }>();

  await recordEdit(supabase, projectId, currentStage, {
    stageLabel: agent.label,
    deliveryText: lastDelivery?.text ?? null,
    approvedAt: new Date().toISOString(),
  });

  const isLastSquadStage = agent.key === "montagem";

  if (isLastSquadStage) {
    // Enqueue the render job.
    const { error: jobError } = await supabase.from("render_jobs").insert({
      project_id: projectId,
      status: "queued",
      progress: 0,
      spec: {
        project_id: projectId,
        name: project.name,
        brief: project.brief,
        format: project.format,
        video_path: project.video_path,
        decisions: {
          roteiro: "aprovado",
          imagem: "aprovado",
          legenda: "aprovado",
          montagem: "aprovado",
        },
        export: { width: 1080, height: 1920, fps: 30, container: "mp4" },
      },
    });

    if (jobError) {
      return { ok: false, error: "Falha ao enfileirar o render." };
    }

    await supabase
      .from("projects")
      .update({ stage: "render", status: "renderizando" })
      .eq("id", projectId);

    await supabase.from("messages").insert({
      project_id: projectId,
      role: "system",
      kind: "delivery",
      stage: "render",
      text: "Render enfileirado 🟢 — o worker vai processar e o vídeo final aparece aqui.",
    });

    revalidatePath(`/projetos/${projectId}`);
    return { ok: true };
  }

  // Advance to the next squad stage and let that agent deliver.
  const next = nextStage(currentStage);
  if (!next) return { ok: false, error: "Sem próxima etapa." };

  await supabase
    .from("projects")
    .update({ stage: next, status: "em_andamento" })
    .eq("id", projectId);

  const advanced = { ...project, stage: next };
  await postStageDelivery(supabase, advanced);

  revalidatePath(`/projetos/${projectId}`);
  return { ok: true };
}

/**
 * User requests an adjustment. The adjustment text is saved as a user message
 * and the SAME stage agent re-delivers, incorporating the feedback.
 */
export async function requestAdjustment(
  projectId: string,
  feedback: string
): Promise<ActionResult> {
  const supabase = createClient();
  const clean = feedback.trim();
  if (!clean) return { ok: false, error: "Descreva o ajuste desejado." };

  const project = await loadProject(supabase, projectId);
  if (!project) return { ok: false, error: "Projeto não encontrado." };

  const agent = agentForStage(project.stage as StageKey);
  if (!agent) return { ok: false, error: "Etapa não ajustável." };

  await supabase.from("messages").insert({
    project_id: projectId,
    role: "user",
    kind: "approval_response",
    stage: project.stage,
    text: clean,
    meta: { decision: "adjust" },
  });

  await postStageDelivery(supabase, project, clean);

  revalidatePath(`/projetos/${projectId}`);
  return { ok: true };
}

const BRIEFING_KEYS: (keyof Briefing)[] = [
  "objetivo",
  "publico",
  "oferta",
  "cta",
  "observacoes",
];

/** Updates the structured briefing on a project (editable summary card). */
export async function updateBriefing(
  projectId: string,
  briefing: Briefing
): Promise<ActionResult> {
  const supabase = createClient();
  const project = await loadProject(supabase, projectId);
  if (!project) return { ok: false, error: "Projeto não encontrado." };

  const clean: Briefing = {};
  for (const k of BRIEFING_KEYS) {
    const v = (briefing[k] ?? "").trim();
    if (v) clean[k] = v;
  }
  const hasAny = Object.keys(clean).length > 0;

  const { error } = await supabase
    .from("projects")
    .update({ briefing: hasAny ? clean : null })
    .eq("id", projectId);

  if (error) return { ok: false, error: "Falha ao salvar o briefing." };

  revalidatePath(`/projetos/${projectId}`);
  return { ok: true };
}
