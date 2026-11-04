"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany, withCompany } from "@/lib/company";
import { logAudit } from "@/lib/audit";
import { AGENT_STEPS_INGEST, MARKETPLACES } from "@/lib/marketplace/catalog";

const UUID = /^[0-9a-f-]{36}$/i;

/** Registra links (um por linha). Só https. */
export async function addLinks(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const company = await requireCompany();
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;
  const urls = String(formData.get("links") ?? "").split(/\s+/).map((u) => u.trim()).filter(Boolean).slice(0, 30);
  const bad = urls.filter((u) => { try { return new URL(u).protocol !== "https:"; } catch { return true; } });
  if (!urls.length || bad.length) redirect(`/fontes?erro=${encodeURIComponent(bad.length ? `Link inválido (use https): ${bad[0].slice(0, 80)}` : "Cole pelo menos um link")}`);
  const { error } = await supabase.from("mk_company_sources").insert(urls.map((url) => ({ ...withCompany(company.id), kind: "link", url, note, created_by: user.id })));
  if (error) redirect(`/fontes?erro=${encodeURIComponent(error.message)}`);
  await logAudit(supabase, { action: "fontes.links", entity: "fonte", summary: `${urls.length} link(s) enviado(s)`, companyId: company.id });
  revalidatePath("/fontes");
  redirect("/fontes?ok=1");
}

/** Registra um arquivo já enviado ao Storage pelo navegador (bucket privado mk-fontes/<empresa>/...). */
export async function registerFile(input: { path: string; name: string; mime: string; bytes: number; note?: string }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "sessão expirada" };
  const company = await requireCompany();
  if (!input.path.startsWith(`${company.id}/`) || input.path.includes("..")) return { error: "caminho inválido" };
  const kind = input.mime.startsWith("image/") ? "foto" : input.mime === "application/pdf" ? "pdf" : "arquivo";
  const { error } = await supabase.from("mk_company_sources").insert({
    ...withCompany(company.id), kind, storage_path: input.path, file_name: input.name.slice(0, 200), mime: input.mime.slice(0, 100),
    bytes: input.bytes, note: input.note?.slice(0, 1000) || null, created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/fontes");
  return { ok: true };
}

export async function deleteSource(formData: FormData) {
  const supabase = createClient();
  const company = await requireCompany();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) redirect("/fontes");
  const { data: s } = await supabase.from("mk_company_sources").select("storage_path").eq("id", id).match(byCompany(company.id)).maybeSingle();
  if (s?.storage_path) await supabase.storage.from("mk-fontes").remove([s.storage_path]);
  await supabase.from("mk_company_sources").delete().eq("id", id).match(byCompany(company.id));
  revalidatePath("/fontes");
  redirect("/fontes");
}

/** Cria o job de ingestão: o agente lê os materiais, monta o(s) cadastro(s) e, se pedido, já gera os anúncios. */
export async function startIngest(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const company = await requireCompany();
  const ids = formData.getAll("source").map(String).filter((x) => UUID.test(x)).slice(0, 50);
  if (!ids.length) redirect(`/fontes?erro=${encodeURIComponent("Selecione pelo menos um material")}`);
  const marketplaces = MARKETPLACES.map((m) => m.key).filter((k) => formData.get(`mk_${k}`) === "on");
  const options = {
    gerar_anuncios: formData.get("gerar_anuncios") === "on",
    video: formData.get("video") === "on",
    instrucoes: String(formData.get("instrucoes") ?? "").slice(0, 1000),
  };
  const steps = AGENT_STEPS_INGEST.map((s) => ({ ...s, status: "pending" }));
  const { data, error } = await supabase.from("mk_ad_jobs")
    .insert({ ...withCompany(company.id), kind: "ingestao", source_ids: ids, marketplaces: marketplaces.length ? marketplaces : ["mercado_livre"], options, steps, created_by: user.id })
    .select("id").single();
  if (error || !data) redirect(`/fontes?erro=${encodeURIComponent(error?.message ?? "falha ao criar job")}`);
  await logAudit(supabase, { action: "fontes.ingestao", entity: "job", entityId: data.id, summary: `Agente vai ler ${ids.length} material(is) e montar o cadastro`, companyId: company.id });
  redirect(`/agente/${data.id}`);
}
