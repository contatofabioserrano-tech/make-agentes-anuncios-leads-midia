import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany } from "@/lib/company";
import { PageHeader } from "@/components/PageHeader";
import { fmtDate } from "@/lib/marketplace/catalog";

export const metadata = { title: "Auditoria — MakeOne" };
export const dynamic = "force-dynamic";

const PAGE = 50;

export default async function AuditoriaPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const acao = searchParams.acao ?? "";
  const entidade = searchParams.entidade ?? "";
  const quem = (searchParams.quem ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.p ?? "1", 10) || 1);

  const supabase = createClient();
  const company = await requireCompany();
  let q = supabase.from("mk_audit_events").select("*", { count: "exact" }).match(byCompany(company.id)).order("at", { ascending: false });
  if (acao) q = q.eq("action", acao);
  if (entidade) q = q.eq("entity", entidade);
  if (quem) q = q.ilike("actor_email", `%${quem.replace(/[%,()]/g, " ")}%`);
  const { data, count } = await q.range((page - 1) * PAGE, page * PAGE - 1);
  const rows = data ?? [];
  const { data: facets } = await supabase.from("mk_audit_events").select("action,entity").match(byCompany(company.id)).limit(2000);
  const acoes = Array.from(new Set((facets ?? []).map((f) => f.action))).sort();
  const entidades = Array.from(new Set((facets ?? []).map((f) => f.entity))).sort();
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(acao && { acao }), ...(entidade && { entidade }), ...(quem && { quem }), p: String(p) })}`;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader overline="Controle · trilha imutável" title="Auditoria"
        subtitle="Quem fez o quê e quando: sincronizações do Odoo, jobs do agente, exportações de anúncios. Os registros não podem ser alterados nem apagados pelo portal." />

      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]" method="get">
        <select name="acao" defaultValue={acao} className="input" aria-label="Ação">
          <option value="">Todas as ações</option>
          {acoes.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select name="entidade" defaultValue={entidade} className="input" aria-label="Entidade">
          <option value="">Todas as entidades</option>
          {entidades.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input name="quem" defaultValue={quem} placeholder="E-mail de quem fez…" className="input" aria-label="Quem" />
        <button className="btn-primary">Filtrar ↗</button>
      </form>

      <div className="card overflow-hidden">
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-2 px-5 py-4 md:grid-cols-[170px_1fr_220px] md:items-start">
              <div className="font-mono text-[11px] text-muted-fg">{fmtDate(r.at)}</div>
              <div className="min-w-0">
                <p className="text-sm text-ink">{r.summary ?? r.action}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-fg">
                  {r.action} · {r.entity}{r.entity_id ? ` · ${r.entity_id}` : ""}
                  {r.entity === "job" && r.entity_id && <> · <Link href={`/agente/${r.entity_id}`} className="underline">abrir</Link></>}
                </p>
                {r.details && Object.keys(r.details).length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] text-muted-fg">detalhes</summary>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-[#F4F4EF] p-2 text-[11px]">{JSON.stringify(r.details, null, 2)}</pre>
                  </details>
                )}
              </div>
              <div className="truncate text-xs text-muted-fg md:text-right">{r.actor_email ?? "sistema"}</div>
            </li>
          ))}
          {rows.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-fg">Nenhum evento com esses filtros.</li>}
        </ul>
      </div>

      <nav className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-muted-fg">{count ?? 0} eventos · página {page} de {pages}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={qs(page - 1)} className="btn-secondary !py-2">← Anterior</Link>}
          {page < pages && <Link href={qs(page + 1)} className="btn-secondary !py-2">Próxima →</Link>}
        </div>
      </nav>
    </div>
  );
}
