import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany } from "@/lib/company";
import { brl, fmtDate, MARKETPLACES, type CatalogProduct } from "@/lib/marketplace/catalog";
import { LISTINGS } from "@/lib/marketplace/listings";
import { createAdJob } from "../../agente/actions";

export const dynamic = "force-dynamic";

type D = Record<string, unknown>;
const m2o = (v: unknown) => (Array.isArray(v) && v.length > 1 ? String(v[1]) : null);
const num = (v: unknown, unit = "") => (typeof v === "number" && v > 0 ? `${v.toLocaleString("pt-BR")}${unit}` : null);
const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

function Field({ label, value, required }: { label: string; value: string | null; required?: boolean }) {
  return (
    <div className="border-b border-line py-2.5 sm:grid sm:grid-cols-[220px_1fr] sm:gap-4">
      <dt className="text-xs text-muted-fg">{label}{required && <span className="text-kairos-red"> *</span>}</dt>
      <dd className={`mt-0.5 text-sm sm:mt-0 ${value ? "text-ink" : required ? "text-kairos-red" : "text-muted-fg"}`}>
        {value ?? (required ? "Faltando" : "—")}
      </dd>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <p className="eyebrow mb-1">{n}</p>
      <h2 className="display mb-3 text-[22px]">{title}</h2>
      <dl>{children}</dl>
    </section>
  );
}

export default async function ProdutoPage({ params, searchParams }: { params: { id: string }; searchParams: { erro?: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("mk_catalog_products").select("*").eq("odoo_id", Number(params.id)).match(byCompany((await requireCompany()).id)).maybeSingle();
  if (!data) notFound();
  const p = data as CatalogProduct;
  const d = p.data as D;
  const { data: jobs } = await supabase.from("mk_ad_jobs").select("id,status,created_at,marketplaces").eq("odoo_id", p.odoo_id).order("created_at", { ascending: false }).limit(5);
  const listing = LISTINGS.find((b) => b.listing.odooId === p.odoo_id);
  const imgUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/catalogo/${p.odoo_id}.jpg`;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <nav className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-fg">
        <Link href="/catalogo" className="hover:text-ink">Catálogo</Link> <span className="mx-1">›</span> #{p.odoo_id}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <header className="flex flex-col gap-5 sm:flex-row">
            <div className="flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-white">
              {p.has_image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={imgUrl} alt={p.name_pt} className="h-full w-full object-contain p-2" />
                : <span className="px-3 text-center font-mono text-[10px] uppercase text-kairos-red">Sem foto no Odoo</span>}
            </div>
            <div className="min-w-0">
              <p className="eyebrow mb-2">{p.brand ?? "Sem marca"} · {p.category ?? "Sem categoria"}</p>
              <h1 className="display text-[26px] leading-tight sm:text-[34px]">{p.name_pt}</h1>
              <p className="mt-2 font-mono text-[11px] text-muted-fg">Odoo #{p.odoo_id} · SKU {p.sku ?? "—"} · status {p.status ?? "—"} · sincronizado {fmtDate(p.synced_at)}</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="bar w-48"><div className={`h-full rounded-full ${p.completeness >= 90 ? "bg-emerald-600" : p.completeness >= 50 ? "bg-ink" : "bg-kairos-red"}`} style={{ width: `${p.completeness}%` }} /></div>
                <span className="text-sm font-medium">{p.completeness}% do cadastro</span>
              </div>
            </div>
          </header>

          <Section n="01 / 06" title="Identificação">
            <Field label="Nome comercial (PT)" value={txt(d.kairos_name_pt)} required />
            <Field label="Nome comercial (EN)" value={txt(d.kairos_name_en)} />
            <Field label="Nome comercial (中文)" value={txt(d.kairos_name_zh)} />
            <Field label="Nome técnico" value={txt(d.kairos_technical_name)} />
            <Field label="Marca" value={txt(d.kairos_brand)} required />
            <Field label="Categoria" value={m2o(d.categ_id)} required />
            <Field label="SKU / referência interna" value={txt(d.default_code)} required />
            <Field label="Código de barras (EAN/GTIN)" value={txt(d.barcode)} required />
            <Field label="Tensão (V)" value={txt(d.kairos_voltage)} />
          </Section>

          <Section n="02 / 06" title="Preços e custos">
            <Field label="Custo unitário (USD)" value={num(d.kairos_price_usd)} required />
            <Field label="Custo unitário (BRL)" value={p.price_brl ? brl(p.price_brl) : null} required />
            <Field label="Custo unitário (CNY)" value={num(d.kairos_price_cny)} />
            <Field label="Preço de referência (USD)" value={num(d.kairos_reference_price)} />
            <Field label="Preço de venda" value={(p.list_price ?? 0) > 1 ? brl(p.list_price) : null} required />
            <Field label="Estoque disponível" value={num(d.qty_available, " un")} required />
          </Section>

          <Section n="03 / 06" title="Fiscal e aduaneiro">
            <Field label="NCM aprovado" value={m2o(d.kairos_ncm_id)} required />
            <Field label="NCM sugerido pelo consignatário" value={m2o(d.kairos_ncm_suggested_id)} />
            <Field label="HS internacional" value={m2o(d.kairos_hs_id)} />
            <Field label="HS de origem" value={txt(d.kairos_hs_origin)} />
            <Field label="País de origem" value={m2o(d.kairos_origin_country_id)} required />
            <Field label="Justificativa da classificação" value={txt(d.kairos_ncm_rationale)} />
            <Field label="Descrição fiscal (DUIMP)" value={txt(d.kairos_fiscal_description)} />
            <Field label="Certificados faltando" value={txt(d.kairos_missing_cert_names)} />
          </Section>

          <Section n="04 / 06" title="Logística e embalagem">
            <Field label="Peso da unidade" value={num(d.kairos_fixed_weight, " kg") ?? num(d.weight, " kg")} required />
            <Field label="Peso bruto da unidade" value={num(d.kairos_gross_weight, " kg")} />
            <Field label="Unidades por caixa master" value={num(d.kairos_package_qty)} required />
            <Field label="Caixa master (C × L × A)" value={num(d.kairos_package_length) ? `${d.kairos_package_length} × ${d.kairos_package_width} × ${d.kairos_package_height} cm` : null} required />
            <Field label="Peso bruto da caixa" value={num(d.kairos_package_gross_weight, " kg")} required />
            <Field label="Peso líquido da caixa" value={num(d.kairos_package_net_weight, " kg")} />
            <Field label="Unidades por embalagem interna" value={num(d.kairos_qty_per_inner)} />
            <Field label="Unidades por palete" value={num(d.kairos_pallet_qty)} />
            <Field label="Palete carregado (C × L × A)" value={num(d.kairos_pallet_length) ? `${d.kairos_pallet_length} × ${d.kairos_pallet_width} × ${d.kairos_pallet_height} cm` : null} />
          </Section>

          <Section n="05 / 06" title="Descrições">
            <Field label="Descrição técnica (PT)" value={txt(d.kairos_technical_description)} required />
            <Field label="Descrição técnica (EN)" value={txt(d.kairos_technical_description_en)} />
            <Field label="Descrição de origem" value={txt(d.kairos_origin_description)} />
            <Field label="Descrição de venda" value={txt(d.description_sale)} />
          </Section>

          <Section n="06 / 06" title="Dados para anúncio que o Odoo ainda não tem">
            <Field label="Temperaturas / modo de uso" value={null} />
            <Field label="Caixa de 1 unidade (frete marketplace)" value={null} required />
            <Field label="Autorização da marca (LOA)" value={null} required />
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="card p-5">
            <p className="eyebrow mb-2">O que falta para anunciar</p>
            {p.missing.length ? (
              <ul className="space-y-1.5">
                {p.missing.map((m) => <li key={m} className="flex gap-2 text-sm"><span className="text-kairos-red">●</span>{m}</li>)}
              </ul>
            ) : <p className="text-sm text-emerald-700">Cadastro completo para anunciar.</p>}
          </section>

          <section className="card p-5">
            <p className="eyebrow mb-1">Agente de anúncios</p>
            <h2 className="display mb-3 text-[22px]">Gerar anúncios</h2>
            {searchParams.erro && <p className="mb-3 rounded-lg bg-kairos-red-soft p-3 text-xs text-kairos-red">{searchParams.erro}</p>}
            <form action={createAdJob} className="space-y-3">
              <input type="hidden" name="odoo_id" value={p.odoo_id} />
              <fieldset>
                <legend className="label">Marketplaces</legend>
                <div className="grid grid-cols-2 gap-2">
                  {MARKETPLACES.map((m) => (
                    <label key={m.key} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                      <input type="checkbox" name={`mk_${m.key}`} defaultChecked={m.key === "tiktok_shop"} /> {m.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="cenas_ia" defaultChecked className="mt-1" />
                <span>Cenas de uso com IA <span className="block text-[11px] text-muted-fg">~3 créditos Higgsfield por imagem</span></span></label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="video" className="mt-1" />
                <span>Vídeo comercial (voz + trilha) <span className="block text-[11px] text-muted-fg">~400 créditos Higgsfield + ElevenLabs</span></span></label>
              <textarea name="observacoes" rows={2} placeholder="Observações para o agente (opcional)" className="input" />
              <button className="btn-red w-full">Acionar agente ↗</button>
              <Link href={`/cadastro/novo?de=${p.odoo_id}`} className="btn-secondary w-full">Copiar para cadastro</Link>
            </form>
          </section>

          {(listing || (jobs && jobs.length > 0)) && (
            <section className="card p-5">
              <p className="eyebrow mb-2">Anúncios deste produto</p>
              <ul className="space-y-2 text-sm">
                {listing && <li><Link href={`/anuncios/${listing.listing.slug}`} className="hover:underline">TikTok Shop · anúncio pronto ↗</Link></li>}
                {(jobs ?? []).map((j) => (
                  <li key={j.id}><Link href={`/agente/${j.id}`} className="hover:underline">Job {fmtDate(j.created_at)} · {j.status} ↗</Link></li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
