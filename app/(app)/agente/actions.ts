"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany, withCompany, isLegacy } from "@/lib/company";
import { logAudit } from "@/lib/audit";
import { AGENT_STEPS, MARKETPLACES } from "@/lib/marketplace/catalog";

/** Cria um job para o agente de anúncios (o worker pega da fila mk_ad_jobs). */
export async function createAdJob(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const company = await requireCompany();
  const odooId = Number(formData.get("odoo_id")) || null;
  const draftId = String(formData.get("draft_id") ?? "") || null;
  const back = draftId ? `/cadastro/${draftId}` : `/catalogo/${odooId ?? ""}`;
  const marketplaces = MARKETPLACES.map((m) => m.key).filter((k) => formData.get(`mk_${k}`) === "on");
  if ((!odooId && !draftId) || marketplaces.length === 0) {
    redirect(`${back}?erro=${encodeURIComponent("Escolha pelo menos um marketplace")}`);
  }
  const options = {
    cenas_ia: formData.get("cenas_ia") === "on",
    video: formData.get("video") === "on",
    observacoes: String(formData.get("observacoes") ?? "").slice(0, 1000),
  };
  const steps = AGENT_STEPS.map((s) => ({ ...s, status: "pending" }));

  const { data, error } = await supabase
    .from("mk_ad_jobs")
    .insert({ ...withCompany(company.id), ...(isLegacy(company.id) ? {} : { kind: "anuncio", draft_id: draftId }), odoo_id: odooId, marketplaces, options, steps, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) redirect(`${back}?erro=${encodeURIComponent(error?.message ?? "falha ao criar job")}`);

  await logAudit(supabase, {
    action: "agente.job_criado", entity: "job", entityId: data.id,
    summary: `Agente acionado para ${odooId ? `o produto #${odooId}` : "o cadastro"} (${marketplaces.join(", ")})`,
    details: { odoo_id: odooId, draft_id: draftId, marketplaces, options }, companyId: company.id,
  });
  revalidatePath("/agente");
  redirect(`/agente/${data.id}`);
}

/** Cancela um job ainda na fila ou em execução (RLS: só quem criou). */
export async function cancelAdJob(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id"));
  const company = await requireCompany();
  const { error } = await supabase.from("mk_ad_jobs").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("id", id).match(byCompany(company.id));
  await logAudit(supabase, {
    action: "agente.job_cancelado", entity: "job", entityId: id,
    summary: error ? `Falha ao cancelar job: ${error.message}` : "Job do agente cancelado", companyId: company.id,
  });
  revalidatePath(`/agente/${id}`);
  redirect(`/agente/${id}`);
}
