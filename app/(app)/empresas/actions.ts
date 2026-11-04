"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_COOKIE } from "@/lib/company";
import { logAudit } from "@/lib/audit";
import { validCnpj } from "@/lib/cnpj";

const UUID = /^[0-9a-f-]{36}$/i;
const t = (fd: FormData, k: string, n = 160) => String(fd.get(k) ?? "").trim().slice(0, n) || null;
const digits = (v: string | null) => (v ? v.replace(/\D/g, "") || null : null);
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

async function readForm(fd: FormData) {
  const cnpj = digits(t(fd, "cnpj", 20));
  const errors: string[] = [];
  const name = t(fd, "name", 120);
  if (!name || name.length < 2) errors.push("Nome fantasia é obrigatório");
  if (cnpj && !validCnpj(cnpj)) errors.push("CNPJ inválido");
  const email = t(fd, "email");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("E-mail inválido");
  const site = t(fd, "site_url", 300);
  if (site && !/^https:\/\//i.test(site)) errors.push("Site deve começar com https://");
  const logo = t(fd, "logo_url", 500);
  if (logo && !/^https:\/\//i.test(logo)) errors.push("Logo inválido");
  const color = (k: string) => { const v = t(fd, k, 7); return v && /^#[0-9a-f]{6}$/i.test(v) ? v : null; };
  return {
    errors,
    row: {
      name, legal_name: t(fd, "legal_name"), cnpj, state_registration: t(fd, "state_registration", 30),
      email, phone: t(fd, "phone", 30), whatsapp: digits(t(fd, "whatsapp", 30)), segment: t(fd, "segment", 120),
      site_url: site, logo_url: logo, color_primary: color("color_primary") ?? "#111111", color_accent: color("color_accent") ?? "#E11C24",
      address: {
        cep: digits(t(fd, "cep", 10)), street: t(fd, "street"), number: t(fd, "number", 20), street2: t(fd, "street2"),
        district: t(fd, "district"), city: t(fd, "city"), state: t(fd, "state", 2)?.toUpperCase(), country: t(fd, "country", 60) ?? "Brasil",
      },
    },
  };
}

/** Admin da plataforma cria a empresa (padrão = sobe materiais; odoo = integra um Odoo). */
export async function createCompany(fd: FormData) {
  const supabase = createClient();
  const { errors, row } = await readForm(fd);
  const kind = fd.get("kind") === "odoo" ? "odoo" : "padrao";
  const slug = slugify(t(fd, "slug", 40) ?? row.name ?? "");
  if (slug.length < 2) errors.push("Identificador inválido");
  if (errors.length) redirect(`/empresas?erro=${encodeURIComponent(errors.join(" · "))}`);
  const { data, error } = await supabase.from("mk_companies").insert({ ...row, slug, kind }).select("id").single();
  if (error || !data) redirect(`/empresas?erro=${encodeURIComponent(error?.message ?? "falha")}`);
  await logAudit(supabase, { action: "empresa.criada", entity: "empresa", entityId: data.id, summary: `Empresa ${row.name} criada (${kind})`, companyId: data.id });
  cookies().set(COMPANY_COOKIE, data.id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 31536000 });
  revalidatePath("/", "layout");
  redirect(`/empresas/${data.id}?ok=1`);
}

export async function updateCompany(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) redirect("/empresas");
  const supabase = createClient();
  const { errors, row } = await readForm(fd);
  if (errors.length) redirect(`/empresas/${id}?erro=${encodeURIComponent(errors.join(" · "))}`);
  const { error } = await supabase.from("mk_companies").update(row).eq("id", id);
  await logAudit(supabase, { action: "empresa.atualizada", entity: "empresa", entityId: id, summary: error ? `Falha: ${error.message}` : `Ficha de ${row.name} atualizada`, companyId: id });
  revalidatePath("/", "layout");
  redirect(`/empresas/${id}?${error ? `erro=${encodeURIComponent(error.message)}` : "ok=1"}`);
}

/** Convida por e-mail: se a pessoa já tem conta vira membro na hora; senão fica o convite (aplicado no 1º acesso). */
export async function inviteMember(fd: FormData) {
  const id = String(fd.get("company_id") ?? "");
  if (!UUID.test(id)) redirect("/empresas");
  const email = (t(fd, "email") ?? "").toLowerCase();
  const role = ["dono", "editor", "leitor"].includes(String(fd.get("role"))) ? String(fd.get("role")) : "editor";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect(`/empresas/${id}?erro=${encodeURIComponent("E-mail inválido")}`);
  const supabase = createClient();
  const { data: how, error } = await supabase.rpc("mk_invite", { p_company: id, p_email: email, p_role: role });
  const prof = how === "membro";
  await logAudit(supabase, { action: "empresa.convite", entity: "empresa", entityId: id, summary: error ? `Falha ao convidar ${email}: ${error.message}` : `${email} ${prof ? "incluído" : "convidado"} como ${role}`, companyId: id });
  revalidatePath(`/empresas/${id}`);
  redirect(`/empresas/${id}?${error ? `erro=${encodeURIComponent(error.message)}` : "ok=1"}`);
}

export async function removeMember(fd: FormData) {
  const id = String(fd.get("company_id") ?? "");
  const user = String(fd.get("user_id") ?? "");
  const email = String(fd.get("email") ?? "");
  if (!UUID.test(id)) redirect("/empresas");
  const supabase = createClient();
  if (UUID.test(user)) await supabase.from("mk_company_members").delete().eq("company_id", id).eq("user_id", user);
  if (email) await supabase.from("mk_company_invites").delete().eq("company_id", id).eq("email", email);
  revalidatePath(`/empresas/${id}`);
  redirect(`/empresas/${id}`);
}
