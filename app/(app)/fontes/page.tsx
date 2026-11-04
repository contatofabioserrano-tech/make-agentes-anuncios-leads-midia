import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany, isLegacy } from "@/lib/company";
import { PageHeader } from "@/components/PageHeader";
import { LegacyNotice } from "@/components/LegacyNotice";
import { fmtDate, MARKETPLACES } from "@/lib/marketplace/catalog";
import { addLinks, deleteSource, startIngest } from "./actions";
import { Uploader } from "./Uploader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enviar materiais" };

const KIND: Record<string, string> = { link: "Link", foto: "Foto", pdf: "PDF", arquivo: "Arquivo" };
const STATUS: Record<string, string> = { novo: "novo", processando: "lendo…", processado: "lido", erro: "erro" };

export default async function FontesPage({ searchParams }: { searchParams: { erro?: string; ok?: string } }) {
  const company = await requireCompany();
  if (isLegacy(company.id)) return <LegacyNotice what="O envio de links, fotos e PDFs" />;
  const { data } = await createClient().from("mk_company_sources")
    .select("id,kind,url,storage_path,file_name,bytes,note,status,created_at,result").match(byCompany(company.id))
    .order("created_at", { ascending: false }).limit(200);
  const rows = data ?? [];
  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader overline={`${company.name} · materiais`} title="Enviar materiais"
        subtitle="Suba links da página do produto, fotos e PDFs (catálogo, ficha técnica). O agente lê tudo, monta o cadastro padrão e gera os anúncios." />
      {searchParams.erro && <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{searchParams.erro}</p>}
      {searchParams.ok && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Material registrado.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <h2 className="display mb-3 text-[20px]">1 · Links</h2>
          <form action={addLinks} className="space-y-3">
            <label htmlFor="links" className="label">Um link por linha (página do produto, Alibaba, site do fabricante…)</label>
            <textarea id="links" name="links" rows={4} className="input" placeholder="https://..." />
            <label htmlFor="note" className="label">Observação (opcional)</label>
            <input id="note" name="note" className="input" maxLength={1000} placeholder="ex.: é o mesmo produto em 3 cores" />
            <button className="btn-secondary">Adicionar links</button>
          </form>
        </section>
        <section className="card p-5 sm:p-6">
          <h2 className="display mb-3 text-[20px]">2 · Fotos e PDFs</h2>
          <Uploader companyId={company.id} />
        </section>
      </div>

      <section className="card p-5 sm:p-6">
        <h2 className="display mb-3 text-[20px]">3 · Gerar cadastro e anúncios</h2>
        {rows.length === 0 ? <p className="text-sm text-muted-fg">Nenhum material ainda.</p> : (
          <form action={startIngest} className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-fg"><tr><th className="py-2 pr-2"></th><th>Tipo</th><th>Material</th><th>Status</th><th>Enviado</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td className="py-2 pr-2"><input type="checkbox" name="source" value={r.id} defaultChecked={r.status === "novo"} aria-label="usar este material" /></td>
                      <td><span className="chip border-line">{KIND[r.kind] ?? r.kind}</span></td>
                      <td className="max-w-[420px] truncate">
                        {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline decoration-black/20">{r.url}</a>
                          : <a href={`/fontes/arquivo?path=${encodeURIComponent(r.storage_path ?? "")}`} target="_blank" className="underline decoration-black/20">{r.file_name}</a>}
                        {r.note && <div className="text-xs text-muted-fg">{r.note}</div>}
                      </td>
                      <td className="text-xs">{STATUS[r.status] ?? r.status}</td>
                      <td className="text-xs text-muted-fg">{fmtDate(r.created_at)}</td>
                      <td className="text-right"><button formAction={deleteSource} name="id" value={r.id} className="text-xs text-accent">remover</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 rounded-xl bg-surface-muted p-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="gerar_anuncios" defaultChecked /> Já gerar os anúncios depois do cadastro</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="video" defaultChecked /> Com vídeo</label>
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                {MARKETPLACES.map((m) => (<label key={m.key} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name={`mk_${m.key}`} defaultChecked={m.key !== "alibaba"} /> {m.label}</label>))}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="instrucoes" className="label">Instruções para o agente (opcional)</label>
                <input id="instrucoes" name="instrucoes" className="input" maxLength={1000} placeholder="ex.: preço sugerido R$ 129; destacar garantia de 12 meses" />
              </div>
            </div>
            <button className="btn-red">Ler materiais e montar cadastro ↗</button>
          </form>
        )}
      </section>
    </div>
  );
}
