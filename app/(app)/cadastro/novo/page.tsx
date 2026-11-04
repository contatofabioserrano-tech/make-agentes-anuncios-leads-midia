import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany } from "@/lib/company";
import { PageHeader } from "@/components/PageHeader";
import { fromOdoo, OPTION_MODELS, type DraftData } from "@/lib/odoo/cotar";
import { CotarForm, loadOptions } from "../CotarForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novo cadastro — MakeOne" };

export default async function NovoCadastro({ searchParams }: { searchParams: { de?: string; erro?: string } }) {
  const supabase = createClient();
  const company = await requireCompany();
  const de = company.kind === "odoo" ? Number(searchParams.de) || null : null;
  let values: DraftData = {};
  if (de) {
    const { data } = await supabase.from("mk_catalog_products").select("data").eq("odoo_id", de).match(byCompany(company.id)).maybeSingle();
    if (data?.data) values = fromOdoo(data.data as Record<string, unknown>);
  }
  const options = await loadOptions(supabase, OPTION_MODELS, company.id);
  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader overline="Cadastro" title={de ? `Copiar Odoo #${de}` : "Novo cadastro"}
        subtitle={de ? "Campos copiados do Odoo (somente leitura lá). Complete o que falta e salve no portal." : "Preencha como no cotar do Odoo."} />
      <CotarForm values={values} options={options} sourceOdooId={de} erro={searchParams.erro} />
    </div>
  );
}
