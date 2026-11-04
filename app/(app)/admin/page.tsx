import { redirect } from "next/navigation";
import { requireSession, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { MachineStatus } from "@/components/MachineStatus";
import type { Profile, Project } from "@/lib/types";
import { AdminProjectsTable, type AdminProjectRow } from "./AdminProjectsTable";

export const metadata = { title: "Admin — MakeOne" };
export const dynamic = "force-dynamic";

async function countRows(
  supabase: ReturnType<typeof createClient>,
  table: string,
  filter?: { column: string; value: string }
): Promise<number> {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter) q = q.eq(filter.column, filter.value);
  const { count } = await q;
  return count ?? 0;
}

export default async function AdminPage() {
  const { profile } = await requireSession();
  if (!isAdmin(profile)) redirect("/projetos");

  const supabase = createClient();

  const [
    profiles,
    projects,
    totalProjects,
    emAndamento,
    concluidos,
    jobsFila,
    rendersDone,
    assets,
    usuarios,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true })
      .returns<Profile[]>(),
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<Project[]>(),
    countRows(supabase, "projects"),
    countRows(supabase, "projects", { column: "status", value: "em_andamento" }),
    countRows(supabase, "projects", { column: "status", value: "concluido" }),
    countRows(supabase, "render_jobs", { column: "status", value: "queued" }),
    countRows(supabase, "render_jobs", { column: "status", value: "done" }),
    countRows(supabase, "library_assets"),
    countRows(supabase, "profiles"),
  ]);

  const profileList = profiles.data ?? [];
  const projectList = projects.data ?? [];
  const ownerName = new Map(
    profileList.map((p) => [p.id, p.name?.trim() || p.email || "—"])
  );

  const projectRows: AdminProjectRow[] = projectList.map((p) => ({
    id: p.id,
    name: p.name,
    owner: ownerName.get(p.owner) ?? "—",
    status: p.status,
    stage: p.stage,
    folder: p.folder || "Geral",
    campaign: p.campaign,
    created_at: p.created_at,
  }));

  const kpis = [
    { label: "Projetos", value: totalProjects, accent: true },
    { label: "Em andamento", value: emAndamento },
    { label: "Concluídos", value: concluidos },
    { label: "Jobs na fila", value: jobsFila },
    { label: "Renders prontos", value: rendersDone },
    { label: "Assets", value: assets },
    { label: "Usuários", value: usuarios },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Admin"
        subtitle="Visão geral da operação — usuários, projetos e relatórios."
      />

      {/* Status da máquina de produção */}
      <div className="mt-6">
        <MachineStatus />
      </div>

      {/* Relatórios / KPIs */}
      <section className="mt-8" aria-labelledby="kpis-heading">
        <h2 id="kpis-heading" className="mb-3 text-sm font-bold text-ink">
          Relatórios
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <StatCard
              key={k.label}
              label={k.label}
              value={k.value}
              accent={k.accent}
            />
          ))}
        </div>
      </section>

      {/* Usuários */}
      <section className="mt-10" aria-labelledby="users-heading">
        <h2 id="users-heading" className="mb-3 text-sm font-bold text-ink">
          Usuários
        </h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-xs uppercase tracking-wide text-muted-fg">
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">E-mail</th>
                  <th className="px-4 py-3 font-semibold">Papel</th>
                </tr>
              </thead>
              <tbody>
                {profileList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-muted-fg">
                      Nenhum usuário.
                    </td>
                  </tr>
                ) : (
                  profileList.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-black/[0.04] last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-ink">
                        {u.name?.trim() || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-fg">{u.email || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`chip ${
                            u.role === "admin"
                              ? "border-transparent bg-brand-gradient text-white"
                              : "border-black/10 bg-surface-muted text-muted-fg"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Projetos */}
      <section className="mt-10" aria-labelledby="projects-heading">
        <h2 id="projects-heading" className="mb-3 text-sm font-bold text-ink">
          Projetos
        </h2>
        <AdminProjectsTable rows={projectRows} />
      </section>
    </div>
  );
}
