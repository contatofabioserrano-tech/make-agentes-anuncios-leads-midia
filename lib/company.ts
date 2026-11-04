import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/** Empresa do módulo (SaaS multiempresa). kind "odoo" = catálogo vem do Odoo (Kairós); "padrao" = sobe links/fotos/PDFs. */
export interface Company {
  id: string;
  slug: string;
  name: string;
  kind: "odoo" | "padrao";
  color_primary: string | null;
  color_accent: string | null;
  logo_url: string | null;
  site_url: string | null;
  legal_name?: string | null;
  cnpj?: string | null;
  state_registration?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  segment?: string | null;
  address?: CompanyAddress;
}

/** Endereço no padrão do cadastro de parceiro do Odoo (res.partner). */
export interface CompanyAddress { cep?: string; street?: string; number?: string; street2?: string; district?: string; city?: string; state?: string; country?: string }

export const COMPANY_COLS = "id,slug,name,kind,color_primary,color_accent,logo_url,site_url,legal_name,cnpj,state_registration,email,phone,whatsapp,segment,address";

export const COMPANY_COOKIE = "mk_empresa";

/**
 * Modo de transição: enquanto a migração multiempresa (20261103b) não foi aplicada no banco,
 * o portal funciona como antes, só com a Kairós, sem filtrar por company_id.
 */
export const LEGACY_ID = "00000000-0000-0000-0000-00000000ka1r";
const LEGACY: Company = { id: LEGACY_ID, slug: "kairos", name: "Grupo Kairós", kind: "odoo", color_primary: "#111111", color_accent: "#E11C24", logo_url: null, site_url: "https://kairos.importefacil.com" };

export const isLegacy = (id: string | null | undefined) => id === LEGACY_ID;
/** Filtro por empresa para .match(): vazio no modo de transição. */
export const byCompany = (id: string): Record<string, string> => (isLegacy(id) ? {} : { company_id: id });
/** Campos de empresa para insert: vazio no modo de transição. */
export const withCompany = (id: string): { company_id?: string } => (isLegacy(id) ? {} : { company_id: id });

/** Empresas que o usuário logado pode ver (admin da plataforma vê todas — a RLS decide). */
export async function listMyCompanies(): Promise<Company[]> {
  const { data, error } = await createClient().from("mk_companies").select(COMPANY_COLS).order("name");
  if (error) return [LEGACY]; // tabela ainda não existe no banco
  return (data ?? []) as Company[];
}

/**
 * Empresa ativa: a do cookie, se o usuário tiver acesso a ela; senão a primeira da lista.
 * Toda página do módulo filtra por company_id desta empresa (além da RLS).
 */
export async function getActiveCompany(): Promise<{ company: Company | null; companies: Company[] }> {
  const companies = await listMyCompanies();
  const want = cookies().get(COMPANY_COOKIE)?.value;
  const company = companies.find((c) => c.id === want) ?? companies[0] ?? null;
  return { company, companies };
}

/** Para páginas que exigem empresa: devolve a ativa ou lança (o layout mostra o aviso). */
export async function requireCompany(): Promise<Company> {
  const { company } = await getActiveCompany();
  if (!company) throw new Error("Sem empresa: peça a um administrador para incluir você em uma empresa.");
  return company;
}
