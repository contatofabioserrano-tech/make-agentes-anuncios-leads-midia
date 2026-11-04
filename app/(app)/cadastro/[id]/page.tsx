import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany } from "@/lib/company";
import { MARKETPLACES } from "@/lib/marketplace/catalog";
import { createAdJob } from "../../agente/actions";
import { PageHeader } from "@/components/PageHeader";
import { OPTION_MODELS, type DraftData } from "@/lib/odoo/cotar";
import { CotarForm, loadOptions } from "../CotarForm";
import { deleteDraft } from "../actions";
import { DraftPhotos } from "../DraftPhotos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cadastro — Kairós" };

export default async function EditCadastro({ params, searchParams }: { params: { id: string }; searchParams: { erro?: string; ok?: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const supabase = createClient();
  const company = await requireCompany();
  const { data } = await supabase.from("mk_product_drafts").select("*").eq("id", params.id).match(byCompany(company.id)).maybeSingle();
  if (!data) notFound();
  const options = await loadOptions(supabase, OPTION_MODELS, company.id);
  const fotos = ((data.data as Record<string, unknown>)?.fotos as string[] | undefined) ?? [];
  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader overline={`Cadastro · ${data.status}`} title={data.name_pt}
        subtitle={data.source_odoo_id ? `Copiado do Odoo #${data.source_odoo_id}` : "Cadastro novo"}>
        <form action={deleteDraft}><input type="hidden" name="id" value={data.id} /><button className="btn-ghost text-kairos-red" type="submit">Excluir</button></form>
      </PageHeader>
      <section className="card p-5 sm:p-6">
        <h2 className="display mb-1 text-[22px]">Gerar anúncios deste produto</h2>
        <p className="mb-3 text-xs text-muted-fg">O agente monta fotos, textos e vídeo para cada marketplace a partir deste cadastro{fotos.length ? ` e das ${fotos.length} fotos` : data.source_odoo_id ? " e da foto do Odoo" : ". Envie pelo menos 1 foto do produto"}.</p>
        <div className="mb-4"><DraftPhotos draftId={data.id} companyId={company.id} fotos={fotos} /></div>
        <form action={createAdJob} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="draft_id" value={data.id} />
          {MARKETPLACES.map((m) => (
            <label key={m.key} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name={`mk_${m.key}`} defaultChecked={m.key !== "alibaba"} /> {m.label}</label>
          ))}
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="video" defaultChecked /> Vídeo</label>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="cenas_ia" defaultChecked /> Cenas de IA e UGC (Higgsfield)</label>
          <button className="btn-red">Gerar anúncios ↗</button>
        </form>
      </section>
      <CotarForm id={data.id} values={(data.data ?? {}) as DraftData} options={options} sourceOdooId={data.source_odoo_id}
        erro={searchParams.erro} ok={searchParams.ok === "1"} />
    </div>
  );
}
