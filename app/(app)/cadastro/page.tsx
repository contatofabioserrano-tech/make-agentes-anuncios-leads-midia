import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany } from "@/lib/company";
import { PageHeader } from "@/components/PageHeader";
import { fmtDate } from "@/lib/marketplace/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cadastro de produto — Kairós" };

export default async function CadastroPage() {
  const supabase = createClient();
  const company = await requireCompany();
  const { data } = await supabase.from("mk_product_drafts").select("id,name_pt,sku,status,completeness,source_odoo_id,updated_at").match(byCompany(company.id)).order("updated_at", { ascending: false }).limit(100);
  const rows = data ?? [];
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader overline={`${company.name} · cadastro padrão`} title={company.kind === "odoo" ? "Cadastro de produto" : "Produtos"}
        subtitle={company.kind === "odoo" ? "Mesmos campos do cotar do Odoo. Grava no portal; o Odoo continua só leitura." : "Cadastros montados a partir dos materiais enviados (ou preenchidos à mão). Revise e gere os anúncios."}>
        <Link href="/fontes" className="btn-secondary">Enviar materiais</Link>
        <Link href="/cadastro/novo" className="btn-red">Novo cadastro</Link>
      </PageHeader>
      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted-fg">
          Nenhum cadastro ainda. Comece do zero ou abra um produto no <Link href="/catalogo" className="text-kairos-red underline">Catálogo</Link> e use “Copiar para cadastro”.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-fg">
              <tr><th className="px-4 py-3">Produto</th><th>SKU</th><th>Origem</th><th>Completude</th><th>Status</th><th className="pr-4">Atualizado</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-4 py-3"><Link href={`/cadastro/${r.id}`} className="font-medium text-ink hover:text-kairos-red">{r.name_pt}</Link></td>
                  <td className="font-mono text-xs">{r.sku ?? "—"}</td>
                  <td className="text-xs">{r.source_odoo_id ? `Odoo #${r.source_odoo_id}` : "portal"}</td>
                  <td>{r.completeness}%</td>
                  <td><span className="chip border-line">{r.status}</span></td>
                  <td className="pr-4 text-xs text-muted-fg">{fmtDate(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
