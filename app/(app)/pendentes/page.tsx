import Link from "next/link";
import { requireSession, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, CampaignBadge } from "@/components/StatusBadge";
import { CancelJobButton } from "@/components/CancelJobButton";
import { stageLabel } from "@/lib/flow";
import type { Project, ProjectStatus, RenderJob, StageKey } from "@/lib/types";

export const metadata = { title: "Pendentes — Fortuna Creative" };
export const dynamic = "force-dynamic";

export default async function PendentesPage() {
  const { userId, profile } = await requireSession();
  const supabase = createClient();

  let query = supabase
    .from("projects")
    .select("*")
    .neq("status", "concluido")
    .order("updated_at", { ascending: false });

  if (!isAdmin(profile)) {
    query = query.eq("owner", userId);
  }

  const { data: projects } = await query.returns<Project[]>();
  const list = projects ?? [];

  // Jobs canceláveis (queued/claimed/running) dos projetos listados — o mais
  // recente de cada projeto ganha o botão "Cancelar".
  type ActiveJob = Pick<RenderJob, "id" | "project_id" | "status" | "created_at">;
  const activeJobByProject = new Map<string, ActiveJob>();
  if (list.length > 0) {
    const { data: jobs } = await supabase
      .from("render_jobs")
      .select("id, project_id, status, created_at")
      .in(
        "project_id",
        list.map((p) => p.id)
      )
      .in("status", ["queued", "claimed", "running"])
      .order("created_at", { ascending: false })
      .returns<ActiveJob[]>();

    for (const job of jobs ?? []) {
      if (!activeJobByProject.has(job.project_id)) {
        activeJobByProject.set(job.project_id, job);
      }
    }
  }

  const count = (s: ProjectStatus) => list.filter((p) => p.status === s).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Pendentes"
        subtitle="Todos os projetos que ainda não foram concluídos, ordenados pela última atualização."
      />

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Pendentes" value={list.length} accent />
        <StatCard label="Em andamento" value={count("em_andamento")} />
        <StatCard label="Aguardando" value={count("aguardando_aprovacao")} />
        <StatCard label="Renderizando" value={count("renderizando")} />
        <StatCard label="Com erro" value={count("erro")} />
      </div>

      <div className="mt-10 card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-xs uppercase tracking-wide text-muted-fg">
                <th className="px-4 py-3 font-semibold">Projeto</th>
                <th className="px-4 py-3 font-semibold">Pasta</th>
                <th className="px-4 py-3 font-semibold">Campanha</th>
                <th className="px-4 py-3 font-semibold">Etapa</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Atualizado</th>
                <th className="px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-fg">
                    Tudo em dia — nenhum projeto pendente. 🎉
                  </td>
                </tr>
              ) : (
                list.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-black/[0.04] transition-colors last:border-0 hover:bg-surface-muted"
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      <Link
                        href={`/projetos/${p.id}`}
                        className="hover:text-brand-blue"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-fg">
                      {p.folder || "Geral"}
                    </td>
                    <td className="px-4 py-3">
                      <CampaignBadge campaign={p.campaign} />
                    </td>
                    <td className="px-4 py-3 text-muted-fg">
                      {stageLabel(p.stage as StageKey)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-fg">
                      {new Date(p.updated_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      {activeJobByProject.has(p.id) ? (
                        <CancelJobButton
                          jobId={activeJobByProject.get(p.id)!.id}
                          projectId={p.id}
                        />
                      ) : (
                        <span className="text-xs text-muted-fg/60">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
