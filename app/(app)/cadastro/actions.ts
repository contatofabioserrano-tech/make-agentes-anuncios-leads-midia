"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany, withCompany } from "@/lib/company";
import { logAudit } from "@/lib/audit";
import { completeness, parseForm } from "@/lib/odoo/cotar";

const UUID = /^[0-9a-f-]{36}$/i;

/** Cria ou atualiza um rascunho de cadastro (Supabase, nunca o Odoo). */
export async function saveDraft(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const company = await requireCompany();
  const id = String(formData.get("id") ?? "");
  const back = id && UUID.test(id) ? `/cadastro/${id}` : "/cadastro/novo";
  const { data, errors } = parseForm(formData);
  const name = String(data.kairos_name_pt ?? "").trim();
  if (name.length < 2) errors.unshift("Nome comercial (PT) é obrigatório");
  if (errors.length) redirect(`${back}?erro=${encodeURIComponent(errors.slice(0, 4).join(" · "))}`);

  const { pct } = completeness(data);
  const status = formData.get("pronto") === "on" && pct === 100 ? "pronto" : "rascunho";
  const src = Number(formData.get("source_odoo_id")) || null;
  const row = { name_pt: name, sku: data.default_code ? String(data.default_code) : null, data, completeness: pct, status, source_odoo_id: src, updated_at: new Date().toISOString() };

  let savedId = id;
  if (id && UUID.test(id)) {
    // mantém as fotos que vieram dos materiais enviados (não fazem parte do formulário)
    const { data: cur } = await supabase.from("mk_product_drafts").select("data").eq("id", id).maybeSingle();
    const fotos = (cur?.data as Record<string, unknown> | null)?.fotos;
    if (fotos) (row.data as Record<string, unknown>).fotos = fotos;
    const { error } = await supabase.from("mk_product_drafts").update(row).eq("id", id).match(byCompany(company.id));
    if (error) redirect(`${back}?erro=${encodeURIComponent(error.message)}`);
  } else {
    const { data: ins, error } = await supabase.from("mk_product_drafts").insert({ ...row, created_by: user.id, ...withCompany(company.id) }).select("id").single();
    if (error || !ins) redirect(`${back}?erro=${encodeURIComponent(error?.message ?? "falha ao salvar")}`);
    savedId = ins.id;
  }
  await logAudit(supabase, {
    action: id ? "cadastro.atualizado" : "cadastro.criado", entity: "cadastro", entityId: savedId,
    summary: `Cadastro "${name}" ${id ? "atualizado" : "criado"} (${pct}% completo, ${status})`,
    details: { completude: pct, status, origem_odoo: src }, companyId: company.id,
  });
  revalidatePath("/cadastro");
  redirect(`/cadastro/${savedId}?ok=1`);
}

export async function deleteDraft(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) redirect("/cadastro");
  const company = await requireCompany();
  const { error } = await supabase.from("mk_product_drafts").delete().eq("id", id).match(byCompany(company.id));
  await logAudit(supabase, { action: "cadastro.excluido", entity: "cadastro", entityId: id, summary: error ? `Falha ao excluir: ${error.message}` : "Rascunho de cadastro excluído", companyId: company.id });
  revalidatePath("/cadastro");
  redirect("/cadastro");
}

/** Anexa (ou remove) uma foto do bucket privado mk-fontes ao cadastro (data.fotos). */
export async function setDraftPhoto(input: { id: string; path: string; remove?: boolean }) {
  if (!UUID.test(input.id)) return { error: "cadastro inválido" };
  const supabase = createClient();
  const company = await requireCompany();
  if (!input.path.startsWith(`${company.id}/`) || input.path.includes("..")) return { error: "caminho inválido" };
  const { data: cur } = await supabase.from("mk_product_drafts").select("data").eq("id", input.id).match(byCompany(company.id)).maybeSingle();
  if (!cur) return { error: "cadastro não encontrado" };
  const data = (cur.data ?? {}) as Record<string, unknown>;
  const fotos = new Set(Array.isArray(data.fotos) ? (data.fotos as string[]) : []);
  if (input.remove) fotos.delete(input.path); else fotos.add(input.path);
  const { error } = await supabase.from("mk_product_drafts").update({ data: { ...data, fotos: Array.from(fotos).slice(0, 12) }, updated_at: new Date().toISOString() }).eq("id", input.id).match(byCompany(company.id));
  if (input.remove && !error) await supabase.storage.from("mk-fontes").remove([input.path]);
  revalidatePath(`/cadastro/${input.id}`);
  return error ? { error: error.message } : { ok: true };
}
