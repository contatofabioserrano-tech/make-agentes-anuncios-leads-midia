import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany } from "@/lib/company";
import { PageHeader } from "@/components/PageHeader";
import { fmtDate } from "@/lib/marketplace/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads — MakeOne" };

/** Leads das landing pages /loja/[slug]. A RLS só mostra para admin. */
export default async function LeadsPage() {
  const { data } = await createClient().from("mk_leads").select("*").match(byCompany((await requireCompany()).id)).order("created_at", { ascending: false }).limit(200);
  const rows = data ?? [];
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader overline="Landing pages" title="Leads" subtitle="Contatos deixados nas páginas públicas /loja. Visível só para admin." />
      {rows.length === 0 ? <div className="card p-8 text-center text-sm text-muted-fg">Nenhum lead ainda.</div> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-fg"><tr><th className="px-4 py-3">Quando</th><th>Nome</th><th>Contato</th><th>Empresa</th><th>Qtd.</th><th>Produto</th><th className="pr-4">Mensagem</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-4 py-2 text-xs text-muted-fg">{fmtDate(r.created_at)}</td>
                  <td className="py-2 font-medium">{r.name}</td>
                  <td className="py-2 text-xs">{r.email}<br />{r.phone}</td>
                  <td className="py-2 text-xs">{r.company ?? "—"}</td>
                  <td className="py-2 text-xs">{r.quantity ?? "—"}</td>
                  <td className="py-2 font-mono text-xs">{r.slug}</td>
                  <td className="py-2 pr-4 text-xs">{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
