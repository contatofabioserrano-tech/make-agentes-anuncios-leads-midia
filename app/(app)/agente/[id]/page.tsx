import { safeUrl } from "@/lib/marketplace/listings";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany } from "@/lib/company";
import { fmtDate, MARKETPLACES, type AdJob, type AdJobStep } from "@/lib/marketplace/catalog";
import { resolveListing, evaluate } from "@/lib/marketplace/listings";
import { AutoRefresh } from "../AutoRefresh";
import { cancelAdJob } from "../actions";

export const dynamic = "force-dynamic";

const DOT: Record<AdJobStep["status"], string> = {
  pending: "border-line bg-white",
  running: "border-amber-500 bg-amber-400 animate-pulse",
  done: "border-ink bg-ink",
  skipped: "border-line bg-[#E6E6E0]",
  error: "border-kairos-red bg-kairos-red",
};
const LABEL: Record<AdJobStep["status"], string> = {
  pending: "aguardando", running: "em andamento", done: "feito", skipped: "pulado", error: "erro",
};

export default async function JobPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("mk_ad_jobs").select("*").eq("id", params.id).match(byCompany((await requireCompany()).id)).maybeSingle();
  if (!data) notFound();
  const job = data as AdJob;
  const { data: prod } = job.odoo_id
    ? await supabase.from("mk_catalog_products").select("odoo_id,name_pt,brand,completeness").eq("odoo_id", job.odoo_id).maybeSingle()
    : job.draft_id
      ? await supabase.from("mk_product_drafts").select("name_pt,completeness").eq("id", job.draft_id).maybeSingle()
      : { data: null };
  const live = job.status === "queued" || job.status === "running";
  const result = job.result as {
    resumo?: string; zipUrl?: string; marketplaces?: Record<string, { titulo?: string; descricao?: string; bullets?: string[] }>;
    custo?: Record<string, number>; avisos?: string[];
  };
  const bundle = job.status === "done" ? await resolveListing(`job-${job.id}`, supabase) : undefined;
  const ev = bundle ? evaluate(bundle) : undefined;
  const mkLabel = (k: string) => MARKETPLACES.find((m) => m.key === k)?.label ?? k;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <nav className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-fg">
        <Link href="/agente" className="hover:text-ink">Agente</Link> <span className="mx-1">›</span> Job {job.id.slice(0, 8)}
      </nav>
      <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-2">{job.marketplaces.map(mkLabel).join(" · ")}</p>
          <h1 className="display dot text-[28px] leading-tight sm:text-[38px]">{prod?.name_pt ?? (job.kind === "ingestao" ? "Leitura dos materiais enviados" : `Produto #${job.odoo_id ?? "—"}`)}</h1>
          <p className="mt-2 text-xs text-muted-fg">Criado em {fmtDate(job.created_at)} · atualizado {fmtDate(job.updated_at)} · cadastro {prod?.completeness ?? "?"}% completo</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AutoRefresh active={live} />
          {live && (
            <form action={cancelAdJob}><input type="hidden" name="id" value={job.id} /><button className="btn-secondary !py-2">Cancelar</button></form>
          )}
          {bundle && <Link href={`/anuncios/job-${job.id}`} className="btn-primary">Abrir anúncio ↗</Link>}
          {job.kind === "ingestao" && typeof job.result?.draft_id === "string" && <Link href={`/cadastro/${job.result.draft_id}`} className="btn-primary">Abrir cadastro ↗</Link>}
          {job.kind === "ingestao" && typeof job.result?.ad_job_id === "string" && <Link href={`/agente/${job.result.ad_job_id}`} className="btn-secondary">Ver anúncios ↗</Link>}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card p-5 sm:p-6">
          <h2 className="display mb-4 text-[22px]">Etapas do agente</h2>
          <ol className="relative space-y-0">
            {job.steps.map((s, i) => (
              <li key={s.key} className="grid grid-cols-[24px_1fr] gap-3 pb-5 last:pb-0">
                <div className="relative flex justify-center">
                  <span className={`z-10 mt-1 h-3.5 w-3.5 rounded-full border-2 ${DOT[s.status]}`} />
                  {i < job.steps.length - 1 && <span className="absolute top-5 h-full w-px bg-line" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-[11px] text-muted-fg">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-sm font-medium text-ink">{s.label}</span>
                    <span className={`font-mono text-[10px] uppercase ${s.status === "error" ? "text-kairos-red" : "text-muted-fg"}`}>{LABEL[s.status]}</span>
                  </div>
                  {s.detail && <p className="mt-1 whitespace-pre-line text-xs text-muted-fg">{s.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
          {job.status === "queued" && (
            <p className="mt-5 rounded-lg bg-[#F4F4EF] p-3 text-xs text-muted-fg">
              Na fila. O agente roda no worker da máquina (<code>npm run agente</code> na pasta <code>worker/</code>) e começa em segundos quando está ligado.
            </p>
          )}
        </section>

        <aside className="space-y-4">
          {ev && (
            <section className={`rounded-2xl p-5 ${ev.summary.conteudoPronto ? "bg-ink text-white" : "bg-kairos-red text-white"}`}>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] opacity-70">Política TikTok Shop</p>
              <p className="display mt-1 text-[28px] !text-white">{ev.summary.conteudoPronto ? "Aprovado" : "Reprovado"}</p>
              <p className="text-xs opacity-80">{ev.summary.passed}/{ev.summary.total} verificações · {ev.summary.pendencias} pendências do vendedor</p>
            </section>
          )}
          {safeUrl(result.zipUrl) && (
            <section className="card p-5">
              <p className="eyebrow mb-2">Pacote</p>
              <a href={safeUrl(result.zipUrl) ?? "#"} className="btn-red w-full">Baixar pacote ZIP ↗</a>
              {bundle && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <a href={`/anuncios/job-${job.id}/export?format=csv`} className="btn-secondary !py-2">CSV</a>
                  <a href={`/anuncios/job-${job.id}/export?format=json`} className="btn-secondary !py-2">JSON</a>
                </div>
              )}
            </section>
          )}
          {result.resumo && <section className="card p-5 text-sm"><p className="eyebrow mb-2">Resumo</p><p className="whitespace-pre-line">{result.resumo}</p></section>}
          {result.avisos && result.avisos.length > 0 && (
            <section className="card p-5"><p className="eyebrow mb-2">Avisos do agente</p>
              <ul className="space-y-1 text-xs">{result.avisos.map((a) => <li key={a} className="flex gap-2"><span className="text-kairos-red">●</span>{a}</li>)}</ul>
            </section>
          )}
          {result.custo && (
            <section className="card p-5"><p className="eyebrow mb-2">Custo de IA</p>
              <ul className="space-y-1 text-sm">{Object.entries(result.custo).map(([k, v]) => <li key={k} className="flex justify-between"><span className="text-muted-fg">{k}</span><span className="tabular-nums">{v}</span></li>)}</ul>
            </section>
          )}
        </aside>
      </div>

      {result.marketplaces && (
        <section className="space-y-3">
          <h2 className="display text-[22px]">Textos por marketplace</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(result.marketplaces).map(([k, m]) => (
              <article key={k} className="card p-5">
                <p className="eyebrow mb-2">{mkLabel(k)}</p>
                {m.titulo && <p className="text-sm font-medium text-ink">{m.titulo}</p>}
                {m.bullets && <ul className="mt-2 space-y-1 text-xs text-muted-fg">{m.bullets.map((b) => <li key={b}>• {b}</li>)}</ul>}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
