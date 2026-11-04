import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany } from "@/lib/company";
import { PageHeader } from "@/components/PageHeader";
import { brl, fmtDate, type CatalogProduct } from "@/lib/marketplace/catalog";

export const metadata = { title: "Catálogo — Fortuna" };
export const dynamic = "force-dynamic";

const PAGE = 40;

function Completeness({ v }: { v: number }) {
  const color = v >= 90 ? "bg-emerald-600" : v >= 70 ? "bg-ink" : v >= 50 ? "bg-[#9A9A90]" : "bg-kairos-red";
  return (
    <div className="flex items-center gap-2">
      <div className="bar w-20"><div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} /></div>
      <span className="font-mono text-[11px] tabular-nums">{v}%</span>
    </div>
  );
}

export default async function CatalogoPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const q = (searchParams.q ?? "").trim();
  const marca = searchParams.marca ?? "";
  const foto = searchParams.foto ?? "";
  const faixa = searchParams.faixa ?? "";
  const ordem = searchParams.ordem ?? "nome";
  const page = Math.max(1, parseInt(searchParams.p ?? "1", 10) || 1);

  const supabase = createClient();
  const company = await requireCompany();
  if (company.kind !== "odoo") redirect("/cadastro");
  let query = supabase
    .from("mk_catalog_products")
    .select("odoo_id,sku,name_pt,brand,category,status,price_usd,price_brl,has_image,completeness,missing,synced_at", { count: "exact" })
    .match(byCompany(company.id));
  if (q) query = query.or(`name_pt.ilike.%${q.replace(/[%,()]/g, " ")}%,sku.ilike.%${q.replace(/[%,()]/g, " ")}%`);
  if (marca) query = query.eq("brand", marca);
  if (foto === "sim") query = query.eq("has_image", true);
  if (foto === "nao") query = query.eq("has_image", false);
  if (faixa === "baixa") query = query.lt("completeness", 50);
  if (faixa === "media") query = query.gte("completeness", 50).lt("completeness", 90);
  if (faixa === "pronta") query = query.gte("completeness", 90);
  query = ordem === "completude" ? query.order("completeness", { ascending: true }).order("name_pt")
    : ordem === "custo" ? query.order("price_brl", { ascending: false, nullsFirst: false })
    : query.order("name_pt");
  const { data, count } = await query.range((page - 1) * PAGE, page * PAGE - 1);
  const rows = (data ?? []) as CatalogProduct[];

  const { data: brands } = await supabase.from("mk_catalog_products").select("brand").match(byCompany(company.id));
  const brandList = Array.from(new Set((brands ?? []).map((b) => b.brand).filter(Boolean))).sort() as string[];
  const lastSync = rows[0]?.synced_at;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries({ q, marca, foto, faixa, ordem }).filter(([, v]) => v) as [string, string][]);
    u.set("p", String(p));
    return `?${u.toString()}`;
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader overline="Odoo Kairós · espelho do cadastro" title="Catálogo"
        subtitle={`${count ?? 0} produtos${lastSync ? ` · sincronizado em ${fmtDate(lastSync)}` : ""}. Clique num produto para ver o cadastro completo e gerar anúncios.`} />

      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]" method="get">
        <input name="q" defaultValue={q} placeholder="Buscar por nome ou SKU…" className="input" aria-label="Buscar" />
        <select name="marca" defaultValue={marca} className="input" aria-label="Marca">
          <option value="">Todas as marcas</option>
          {brandList.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select name="faixa" defaultValue={faixa} className="input" aria-label="Completude">
          <option value="">Toda completude</option>
          <option value="baixa">Incompleto (&lt; 50%)</option>
          <option value="media">Parcial (50–89%)</option>
          <option value="pronta">Pronto (≥ 90%)</option>
        </select>
        <select name="foto" defaultValue={foto} className="input" aria-label="Foto">
          <option value="">Com e sem foto</option>
          <option value="sim">Com foto</option>
          <option value="nao">Sem foto</option>
        </select>
        <select name="ordem" defaultValue={ordem} className="input" aria-label="Ordem">
          <option value="nome">Ordem: nome</option>
          <option value="completude">Ordem: menos completos</option>
          <option value="custo">Ordem: maior custo</option>
        </select>
        <button className="btn-primary">Filtrar ↗</button>
      </form>

      {/* Tabela (desktop) */}
      <div className="card hidden overflow-hidden lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-[#FAFAF7]">
            <tr className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-fg">
              <th className="px-4 py-3">Produto</th><th className="px-3">Marca</th><th className="px-3">Custo</th>
              <th className="px-3">Foto</th><th className="px-3">Cadastro</th><th className="px-3">Falta</th><th className="px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.odoo_id} className="hover:bg-[#FAFAF7]">
                <td className="max-w-[420px] px-4 py-3">
                  <Link href={`/catalogo/${p.odoo_id}`} className="line-clamp-2 font-medium text-ink hover:underline">{p.name_pt}</Link>
                  <p className="font-mono text-[11px] text-muted-fg">#{p.odoo_id} · {p.sku ?? "sem SKU"}</p>
                </td>
                <td className="px-3 text-muted-fg">{p.brand ?? "—"}</td>
                <td className="px-3 tabular-nums">{brl(p.price_brl)}</td>
                <td className="px-3">{p.has_image ? "✓" : <span className="text-kairos-red">✕</span>}</td>
                <td className="px-3"><Completeness v={p.completeness} /></td>
                <td className="max-w-[260px] px-3 text-[12px] text-muted-fg">{(p.missing ?? []).slice(0, 3).join(" · ")}{p.missing.length > 3 ? ` +${p.missing.length - 3}` : ""}</td>
                <td className="px-4 text-right"><Link href={`/catalogo/${p.odoo_id}`} className="font-mono text-[11px] uppercase tracking-[0.1em] hover:text-kairos-red">Abrir ↗</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards (celular/tablet) */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {rows.map((p) => (
          <li key={p.odoo_id}>
            <Link href={`/catalogo/${p.odoo_id}`} className="card block p-4">
              <p className="line-clamp-2 text-sm font-medium text-ink">{p.name_pt}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-fg">#{p.odoo_id} · {p.brand ?? "—"} · {brl(p.price_brl)}</p>
              <div className="mt-3 flex items-center justify-between">
                <Completeness v={p.completeness} />
                <span className="text-[11px] text-muted-fg">{p.has_image ? "com foto" : "sem foto"}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {rows.length === 0 && <p className="card p-8 text-center text-sm text-muted-fg">Nenhum produto com esses filtros.</p>}

      <nav className="flex items-center justify-between" aria-label="Paginação">
        <span className="font-mono text-[11px] text-muted-fg">Página {page} de {pages}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={qs(page - 1)} className="btn-secondary !py-2">← Anterior</Link>}
          {page < pages && <Link href={qs(page + 1)} className="btn-secondary !py-2">Próxima →</Link>}
        </div>
      </nav>
    </div>
  );
}
