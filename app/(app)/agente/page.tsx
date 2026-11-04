import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany } from "@/lib/company";
import { PageHeader } from "@/components/PageHeader";
import { fmtDate, MARKETPLACES, type AdJob } from "@/lib/marketplace/catalog";
import { AutoRefresh } from "./AutoRefresh";

export const metadata = { title: "Agente de anúncios — Fortuna" };
export const dynamic = "force-dynamic";

const STATUS: Record<AdJob["status"], { label: string; cls: string }> = {
  queued: { label: "Na fila", cls: "bg-[#EDEDE7] text-ink" },
  running: { label: "Gerando", cls: "bg-amber-100 text-amber-800" },
  done: { label: "Pronto", cls: "bg-emerald-100 text-emerald-800" },
  error: { label: "Erro", cls: "bg-kairos-red-soft text-kairos-red" },
  canceled: { label: "Cancelado", cls: "bg-[#EDEDE7] text-muted-fg" },
};

export default async function AgentePage() {
  const supabase = createClient();
  const { data } = await supabase.from("mk_ad_jobs").select("*").match(byCompany((await requireCompany()).id)).order("created_at", { ascending: false }).limit(50);
  const jobs = (data ?? []) as AdJob[];
  const ids = Array.from(new Set(jobs.map((j) => j.odoo_id)));
  const { data: prods } = ids.length
    ? await supabase.from("mk_catalog_products").select("odoo_id,name_pt,brand").in("odoo_id", ids)
    : { data: [] };
  const name = new Map((prods ?? []).map((p) => [p.odoo_id, p]));
  const live = jobs.some((j) => j.status === "queued" || j.status === "running");
  const mkLabel = (k: string) => MARKETPLACES.find((m) => m.key === k)?.label ?? k;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader overline="IA · do cadastro ao pacote pronto" title="Agente de anúncios"
        subtitle="Escolha um produto no catálogo e acione o agente. Ele lê o Odoo, monta fotos no padrão, cenas de uso, textos, dúvidas, vídeo, valida a política de cada marketplace e entrega o pacote.">
        <AutoRefresh active={live} />
        <Link href="/catalogo" className="btn-primary">Escolher produto ↗</Link>
      </PageHeader>

      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          ["01", "Você escolhe o produto", "No catálogo do Odoo, com os marketplaces de destino."],
          ["02", "O agente produz", "Fotos, cenas, textos, dúvidas e vídeo, checando cada regra."],
          ["03", "Você revisa e publica", "Pacote pronto: imagens, vídeo, JSON/CSV para o Seller Center."],
        ].map(([n, t, s]) => (
          <li key={n} className="card p-5">
            <p className="font-mono text-[11px] text-muted-fg">{n}</p>
            <p className="mt-1 text-sm font-medium text-ink">{t}</p>
            <p className="mt-1 text-xs text-muted-fg">{s}</p>
          </li>
        ))}
      </ol>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="display text-[22px]">Trabalhos</h2>
          <span className="font-mono text-[11px] text-muted-fg">{jobs.length} recentes</span>
        </div>
        <ul className="divide-y divide-line">
          {jobs.map((j) => {
            const done = j.steps.filter((s) => s.status === "done" || s.status === "skipped").length;
            const p = name.get(j.odoo_id);
            return (
              <li key={j.id}>
                <Link href={`/agente/${j.id}`} className="grid gap-3 px-5 py-4 hover:bg-[#FAFAF7] sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{p?.name_pt ?? `Produto #${j.odoo_id}`}</p>
                    <p className="mt-0.5 text-[11px] text-muted-fg">{fmtDate(j.created_at)} · {j.marketplaces.map(mkLabel).join(", ")}</p>
                    <div className="bar mt-2 max-w-sm"><div className="h-full rounded-full bg-ink" style={{ width: `${(done / Math.max(1, j.steps.length)) * 100}%` }} /></div>
                  </div>
                  <span className={`justify-self-start rounded-full px-3 py-1 font-mono text-[11px] uppercase sm:justify-self-end ${STATUS[j.status].cls}`}>{STATUS[j.status].label} · {done}/{j.steps.length}</span>
                </Link>
              </li>
            );
          })}
          {jobs.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-muted-fg">
              Nenhum trabalho ainda. <Link href="/catalogo" className="underline">Escolha um produto no catálogo</Link> e clique em “Acionar agente”.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
