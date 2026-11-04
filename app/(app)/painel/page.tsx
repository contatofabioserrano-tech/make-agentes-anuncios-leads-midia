import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany } from "@/lib/company";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { LISTINGS, evaluate } from "@/lib/marketplace/listings";
import { fmtDate, type AdJob } from "@/lib/marketplace/catalog";

export const metadata = { title: "Visão geral — Fortuna" };
export const dynamic = "force-dynamic";

export default async function PainelPage() {
  const supabase = createClient();
  const company = await requireCompany();
  const [{ data: drafts }, { data: products }, { data: jobs }, { data: audit }] = await Promise.all([
    supabase.from("mk_product_drafts").select("id,completeness").match(byCompany(company.id)),
    supabase.from("mk_catalog_products").select("odoo_id,completeness,missing,has_image,brand").match(byCompany(company.id)),
    supabase.from("mk_ad_jobs").select("id,odoo_id,status,created_at,steps").match(byCompany(company.id)).order("created_at", { ascending: false }).limit(5),
    supabase.from("mk_audit_events").select("id,at,actor_email,action,summary").match(byCompany(company.id)).order("at", { ascending: false }).limit(6),
  ]);
  const isOdoo = company.kind === "odoo";
  const ps = isOdoo ? products ?? [] : (drafts ?? []).map((d) => ({ odoo_id: 0, completeness: d.completeness, missing: [] as string[], has_image: true, brand: null }));
  const total = ps.length;
  const avg = total ? Math.round(ps.reduce((s, p) => s + (p.completeness ?? 0), 0) / total) : 0;
  const semFoto = ps.filter((p) => !p.has_image).length;
  const prontos = !isOdoo ? 0 : LISTINGS.filter((b) => evaluate(b).summary.conteudoPronto).length;
  const running = (jobs ?? []).filter((j) => j.status === "queued" || j.status === "running").length;

  // Funil de prontidão para anunciar (faixas de completude do cadastro)
  const bands = [
    { label: "Cadastro incompleto (< 50%)", n: ps.filter((p) => p.completeness < 50).length },
    { label: "Básico (50–69%)", n: ps.filter((p) => p.completeness >= 50 && p.completeness < 70).length },
    { label: "Quase pronto (70–89%)", n: ps.filter((p) => p.completeness >= 70 && p.completeness < 90).length },
    { label: "Pronto para anunciar (≥ 90%)", n: ps.filter((p) => p.completeness >= 90).length },
  ];
  const maxBand = Math.max(1, ...bands.map((b) => b.n));

  // Lacunas mais comuns = próximos movimentos do cadastro
  const gaps = new Map<string, number>();
  ps.forEach((p) => (p.missing as string[]).forEach((m) => gaps.set(m, (gaps.get(m) ?? 0) + 1)));
  const topGaps = Array.from(gaps.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader overline={`${company.name} · ${isOdoo ? "catálogo Odoo" : "materiais"} → anúncio`} title="Visão geral" subtitle={isOdoo ? "Cada produto do Odoo conectado ao próximo anúncio." : "Envie links, fotos e PDFs: a máquina monta o cadastro e os anúncios."} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Produtos no catálogo" value={total} note={isOdoo ? "Espelho do Odoo" : "Cadastros da empresa"} />
        <StatCard label="Completude média do cadastro" value={`${avg}%`} note="Campos exigidos por marketplace" accent />
        <StatCard label={isOdoo ? "Sem foto no Odoo" : "Sem foto"} value={semFoto} note={`${total ? Math.round((semFoto / total) * 100) : 0}% do catálogo`} />
        <StatCard label="Anúncios aprovados na política" value={prontos} note={`${running} job(s) do agente em andamento`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-[22px]">Próximos movimentos</h2>
            <Link href="/catalogo?ordem=completude" className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-fg hover:text-ink">Ver catálogo ↗</Link>
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {topGaps.map(([g, n]) => (
              <li key={g} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink">Completar: {g}</p>
                  <p className="text-[11px] text-muted-fg">Bloqueia ou enfraquece o anúncio no marketplace</p>
                </div>
                <span className="shrink-0 rounded-full bg-kairos-red-soft px-2.5 py-1 font-mono text-[11px] text-kairos-red">{n} produtos</span>
              </li>
            ))}
            {topGaps.length === 0 && <li className="py-6 text-sm text-muted-fg">Catálogo ainda não sincronizado.</li>}
          </ul>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-[22px]">Seu funil</h2>
            <Link href="/catalogo" className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-fg hover:text-ink">Abrir ↗</Link>
          </div>
          <ul className="space-y-4">
            {bands.map((b, i) => (
              <li key={b.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
                <span className="text-xs text-muted-fg">{b.label}</span>
                <span className="text-sm font-medium tabular-nums">{b.n}</span>
                <div className="bar col-span-2">
                  <div className={`h-full rounded-full ${i === 3 ? "bg-kairos-red" : "bg-[#BDBDB4]"}`} style={{ width: `${(b.n / maxBand) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-[22px]">Agente de anúncios</h2>
            <Link href="/agente" className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-fg hover:text-ink">Abrir agente ↗</Link>
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {(jobs as AdJob[] | null ?? []).map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 py-3">
                <Link href={`/agente/${j.id}`} className="min-w-0 text-sm text-ink hover:underline">Produto #{j.odoo_id} · {fmtDate(j.created_at)}</Link>
                <span className="font-mono text-[11px] uppercase text-muted-fg">{j.status}</span>
              </li>
            ))}
            {(!jobs || jobs.length === 0) && <li className="py-6 text-sm text-muted-fg">Nenhum job ainda. Escolha um produto no catálogo e clique em “Gerar anúncios”.</li>}
          </ul>
        </section>
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-[22px]">Auditoria recente</h2>
            <Link href="/auditoria" className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-fg hover:text-ink">Ver tudo ↗</Link>
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {(audit ?? []).map((a) => (
              <li key={a.id} className="py-3">
                <p className="text-sm text-ink">{a.summary ?? a.action}</p>
                <p className="text-[11px] text-muted-fg">{fmtDate(a.at)} · {a.actor_email ?? "sistema"} · <span className="font-mono">{a.action}</span></p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="eyebrow mb-2">Agente · seu próximo movimento</p>
          <p className="display text-[26px] leading-tight sm:text-[32px]">Um produto do Odoo vira anúncio completo em minutos.</p>
          <p className="mt-2 max-w-xl text-sm text-muted-fg">Fotos no padrão, cenas de uso, textos, dúvidas, vídeo e validação da política — tudo num pacote pronto para o Seller Center.</p>
        </div>
        <Link href="/agente" className="btn-primary shrink-0">Abrir agente ↗</Link>
      </section>
    </div>
  );
}
