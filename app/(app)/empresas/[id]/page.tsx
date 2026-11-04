import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_COLS, type Company } from "@/lib/company";
import { PageHeader } from "@/components/PageHeader";
import { CompanyFields } from "../CompanyFields";
import { LogoField } from "../LogoField";
import { inviteMember, removeMember, updateCompany } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Empresa" };

const ROLE: Record<string, string> = { dono: "Dono (gerencia equipe)", editor: "Editor", leitor: "Leitor" };

export default async function EmpresaPage({ params, searchParams }: { params: { id: string }; searchParams: { erro?: string; ok?: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const supabase = createClient();
  const { data } = await supabase.from("mk_companies").select(COMPANY_COLS).eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const c = data as Company;
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("mk_company_members").select("user_id,role,created_at").eq("company_id", c.id),
    supabase.from("mk_company_invites").select("email,role,created_at").eq("company_id", c.id),
  ]);
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profs } = ids.length ? await supabase.from("profiles").select("id,email,name").in("id", ids) : { data: [] };
  const who = (id: string) => (profs ?? []).find((p) => p.id === id);

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader overline={c.kind === "odoo" ? "Empresa integrada ao Odoo" : "Empresa · padrão"} title={c.name} subtitle="Ficha no padrão do cadastro de parceiro do Odoo (Importe Fácil)." />
      {searchParams.erro && <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{searchParams.erro}</p>}
      {searchParams.ok && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Salvo.</p>}

      <form action={updateCompany} className="space-y-6">
        <input type="hidden" name="id" value={c.id} />
        <section className="card p-5 sm:p-6"><h2 className="display mb-4 text-[22px]">Logo</h2><LogoField companyId={c.id} initial={c.logo_url} /></section>
        <CompanyFields c={c} />
        <button className="btn-red">Salvar ficha</button>
      </form>

      <section className="card p-5 sm:p-6">
        <h2 className="display mb-4 text-[22px]">Equipe</h2>
        <ul className="divide-y divide-line">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{who(m.user_id)?.name || who(m.user_id)?.email || m.user_id.slice(0, 8)} <span className="text-muted-fg">· {ROLE[m.role]}</span></span>
              <form action={removeMember}><input type="hidden" name="company_id" value={c.id} /><input type="hidden" name="user_id" value={m.user_id} /><button className="text-xs text-accent">remover</button></form>
            </li>
          ))}
          {(invites ?? []).map((i) => (
            <li key={i.email} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{i.email} <span className="text-muted-fg">· convite pendente ({ROLE[i.role]})</span></span>
              <form action={removeMember}><input type="hidden" name="company_id" value={c.id} /><input type="hidden" name="email" value={i.email} /><button className="text-xs text-accent">cancelar</button></form>
            </li>
          ))}
        </ul>
        <form action={inviteMember} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="company_id" value={c.id} />
          <div className="min-w-[240px] flex-1"><label htmlFor="inv" className="label">Convidar por e-mail</label><input id="inv" name="email" type="email" required className="input" /></div>
          <div><label htmlFor="role" className="label">Papel</label>
            <select id="role" name="role" className="input" defaultValue="editor">{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <button className="btn-secondary">Convidar</button>
        </form>
        <p className="mt-2 text-xs text-muted-fg">Se a pessoa já tem conta, entra na hora. Se não, o acesso é liberado no primeiro login com esse e-mail.</p>
      </section>
    </div>
  );
}
