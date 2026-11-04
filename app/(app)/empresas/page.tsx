import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession, isAdmin } from "@/lib/auth";
import { getActiveCompany, isLegacy } from "@/lib/company";
import { ODOO_ENABLED } from "@/lib/features";
import { LegacyNotice } from "@/components/LegacyNotice";
import { PageHeader } from "@/components/PageHeader";
import { CompanyFields } from "./CompanyFields";
import { createCompany } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Empresas" };

export default async function EmpresasPage({ searchParams }: { searchParams: { erro?: string } }) {
  const { profile } = await requireSession();
  const { company, companies } = await getActiveCompany();
  if (company && isLegacy(company.id)) return <LegacyNotice what="O cadastro de empresas" />;
  if (!isAdmin(profile)) redirect(company ? `/empresas/${company.id}` : "/painel");
  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader overline="Plataforma · multiempresa" title="Empresas" subtitle="Cada empresa vê só os próprios produtos, materiais, anúncios, leads e auditoria." />
      {searchParams.erro && <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{searchParams.erro}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <Link key={c.id} href={`/empresas/${c.id}`} className="card flex items-center gap-4 p-5 hover:shadow-soft-lg">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.logo_url ? <img src={c.logo_url} alt="" className="h-full w-full object-contain p-1" /> : <span className="text-lg font-bold" style={{ color: c.color_accent ?? undefined }}>{c.name[0]}</span>}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{c.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-fg">{c.kind === "odoo" ? "integrada ao Odoo" : "padrão · envia materiais"}{c.cnpj ? ` · CNPJ ${c.cnpj}` : ""}</p>
            </div>
          </Link>
        ))}
      </div>
      <details className="space-y-4">
        <summary className="btn-red inline-flex cursor-pointer">Nova empresa</summary>
        <form action={createCompany} className="mt-4 space-y-4">
          <section className="card grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <div><label htmlFor="slug" className="label">Identificador (URL)</label><input id="slug" name="slug" className="input" placeholder="ex.: minha-empresa" maxLength={40} /></div>
            <div><label htmlFor="kind" className="label">Tipo</label>
              <select id="kind" name="kind" className="input" defaultValue="padrao">
                <option value="padrao">Padrão: envia links, fotos e PDFs</option>
                {ODOO_ENABLED && <option value="odoo">Integrada a um Odoo</option>}
              </select></div>
          </section>
          <CompanyFields />
          <button className="btn-red">Criar empresa</button>
        </form>
      </details>
    </div>
  );
}
