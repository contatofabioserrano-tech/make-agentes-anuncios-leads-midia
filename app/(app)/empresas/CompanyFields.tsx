import type { Company } from "@/lib/company";

/** Ficha da empresa no padrão do cadastro de parceiro (res.partner) do Odoo Importe Fácil. */
export function CompanyFields({ c }: { c?: Partial<Company> }) {
  const a = c?.address ?? {};
  const F = ({ n, l, v, span, ph, req, max }: { n: string; l: string; v?: string | null; span?: boolean; ph?: string; req?: boolean; max?: number }) => (
    <div className={span ? "sm:col-span-2" : undefined}>
      <label htmlFor={n} className="label">{l}{req && <span className="text-accent"> *</span>}</label>
      <input id={n} name={n} defaultValue={v ?? ""} placeholder={ph} required={req} maxLength={max ?? 160} className="input" />
    </div>
  );
  return (
    <>
      <section className="card p-5 sm:p-6">
        <p className="eyebrow mb-1">01</p><h2 className="display mb-4 text-[22px]">Identificação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <F n="name" l="Nome fantasia" v={c?.name} req max={120} />
          <F n="legal_name" l="Razão social" v={c?.legal_name} />
          <F n="cnpj" l="CNPJ" v={c?.cnpj} ph="00.000.000/0000-00" max={20} />
          <F n="state_registration" l="Inscrição estadual" v={c?.state_registration} max={30} />
          <F n="segment" l="Segmento" v={c?.segment} ph="ex.: impressão 3D, pet, moda" span />
        </div>
      </section>
      <section className="card p-5 sm:p-6">
        <p className="eyebrow mb-1">02</p><h2 className="display mb-4 text-[22px]">Endereço</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <F n="cep" l="CEP" v={a.cep} max={10} />
          <F n="street" l="Rua" v={a.street} />
          <F n="number" l="Número" v={a.number} max={20} />
          <F n="street2" l="Complemento" v={a.street2} />
          <F n="district" l="Bairro" v={a.district} />
          <F n="city" l="Cidade" v={a.city} />
          <F n="state" l="UF" v={a.state} max={2} />
          <F n="country" l="País" v={a.country ?? "Brasil"} max={60} />
        </div>
      </section>
      <section className="card p-5 sm:p-6">
        <p className="eyebrow mb-1">03</p><h2 className="display mb-4 text-[22px]">Contato e marca</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <F n="email" l="E-mail" v={c?.email} />
          <F n="phone" l="Telefone" v={c?.phone} max={30} />
          <F n="whatsapp" l="WhatsApp" v={c?.whatsapp} max={30} />
          <F n="site_url" l="Site" v={c?.site_url} ph="https://" max={300} />
          <div>
            <label htmlFor="color_primary" className="label">Cor principal</label>
            <input id="color_primary" name="color_primary" type="color" defaultValue={c?.color_primary ?? "#111111"} className="h-11 w-full rounded-xl border border-line" />
          </div>
          <div>
            <label htmlFor="color_accent" className="label">Cor de destaque</label>
            <input id="color_accent" name="color_accent" type="color" defaultValue={c?.color_accent ?? "#E11C24"} className="h-11 w-full rounded-xl border border-line" />
          </div>
        </div>
      </section>
    </>
  );
}
