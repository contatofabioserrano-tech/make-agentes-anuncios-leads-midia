import { requireSession, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import type { Project, ProjectStatus } from "@/lib/types";
import { NewProjectDialog } from "./NewProjectDialog";
import { ProjectBoard } from "./ProjectBoard";

export const metadata = { title: "Projetos — Fortuna Creative" };
export const dynamic = "force-dynamic";

export default async function ProjetosPage() {
  const { userId, profile } = await requireSession();
  const supabase = createClient();

  // RLS already scopes results: members see own rows, admins see all.
  let query = supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (!isAdmin(profile)) {
    query = query.eq("owner", userId);
  }

  const { data: projects } = await query.returns<Project[]>();
  const list = projects ?? [];

  const count = (s: ProjectStatus) => list.filter((p) => p.status === s).length;
  const pendentes = list.filter((p) => p.status !== "concluido").length;
  const folders = Array.from(
    new Set(list.map((p) => (p.folder || "Geral").trim() || "Geral"))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const stats = [
    { label: "Total", value: list.length, accent: true },
    { label: "Em andamento", value: count("em_andamento") },
    { label: "Aguardando aprovação", value: count("aguardando_aprovacao") },
    { label: "Renderizando", value: count("renderizando") },
    { label: "Concluídos", value: count("concluido") },
    { label: "Pendentes", value: pendentes },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Projetos"
        subtitle="Suba um vídeo e deixe a squad cuidar do resto — você aprova cada etapa."
      >
        <NewProjectDialog folders={folders} />
      </PageHeader>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} accent={s.accent} />
        ))}
      </div>

      <div className="mt-10">
        <ProjectBoard projects={list} folders={folders} />
      </div>
    </div>
  );
}
