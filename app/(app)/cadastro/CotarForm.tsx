import { byCompany } from "@/lib/company";
import Link from "next/link";
import { COTAR_SECTIONS, completeness, type DraftData } from "@/lib/odoo/cotar";
import { saveDraft } from "./actions";

/** Formulário no layout do "cotar" do Odoo (mesmas seções e campos). Renderizado no servidor. */
export function CotarForm({ id, values, options, sourceOdooId, erro, ok }: {
  id?: string;
  values: DraftData;
  options: Record<string, string[]>;
  sourceOdooId?: number | null;
  erro?: string;
  ok?: boolean;
}) {
  const { pct, missing } = completeness(values);
  return (
    <form action={saveDraft} className="space-y-6">
      {id && <input type="hidden" name="id" value={id} />}
      {sourceOdooId ? <input type="hidden" name="source_odoo_id" value={sourceOdooId} /> : null}
      {erro && <p role="alert" className="rounded-xl bg-kairos-red-soft px-4 py-3 text-sm text-kairos-red">{erro}</p>}
      {ok && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Salvo no portal (Supabase). O Odoo não foi alterado.</p>}

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="eyebrow">Completude para marketplaces</p>
          <p className="text-2xl font-extrabold text-ink">{pct}%</p>
          {missing.length > 0 && <p className="text-xs text-muted-fg">Falta: {missing.join(", ")}</p>}
        </div>
        <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-black/[0.06]">
          <div className="h-full bg-kairos-red" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {Object.entries(options).map(([model, list]) => list.length > 0 && (
        <datalist key={model} id={`opt-${model}`}>{list.map((o) => <option key={o} value={o} />)}</datalist>
      ))}

      {COTAR_SECTIONS.map((s) => (
        <section key={s.n} className="card p-5 sm:p-6">
          <p className="eyebrow mb-1">{s.n}</p>
          <h2 className="display mb-4 text-[22px]">{s.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {s.fields.map((f) => {
              const v = values[f.key];
              const common = { id: f.key, name: f.key, defaultValue: v === null || v === undefined ? "" : String(v), className: "input" };
              const hasOpts = f.model && (options[f.model]?.length ?? 0) > 0;
              return (
                <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
                  <label htmlFor={f.key} className="label">
                    {f.label}{f.unit ? ` (${f.unit})` : ""}{f.required && <span className="text-kairos-red"> *</span>}
                  </label>
                  {f.type === "textarea" ? <textarea {...common} rows={4} maxLength={5000} />
                    : f.type === "select" ? (
                      <select {...common}>
                        <option value="">—</option>
                        {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : f.type === "number" ? <input {...common} inputMode="decimal" />
                    : <input {...common} maxLength={300} list={hasOpts ? `opt-${f.model}` : undefined} autoComplete="off" />}
                  <p className="mt-1 font-mono text-[10px] text-muted-fg">
                    {f.key}{f.model ? ` → ${f.model}${hasOpts ? "" : " (opções ainda não sincronizadas)"}` : ""}{f.help ? ` · ${f.help}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper/95 py-4 backdrop-blur">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="pronto" defaultChecked={pct === 100} /> Marcar como pronto (só com 100%)
        </label>
        <div className="flex gap-2">
          <Link href="/cadastro" className="btn-secondary">Voltar</Link>
          <button type="submit" className="btn-red">Salvar cadastro</button>
        </div>
      </div>
    </form>
  );
}

export async function loadOptions(supabase: { from: (t: string) => unknown }, models: string[], companyId: string) {
  type Q = { select: (c: string) => { match: (f: Record<string, string>) => { in: (k: string, v: string[]) => { order: (c: string) => { limit: (n: number) => Promise<{ data: { model: string; name: string; code: string | null }[] | null }> } } } } };
  const { data } = await (supabase.from("mk_odoo_options") as Q).select("model,name,code").match(byCompany(companyId)).in("model", models).order("name").limit(20000);
  const out: Record<string, string[]> = Object.fromEntries(models.map((m) => [m, [] as string[]]));
  for (const r of data ?? []) out[r.model]?.push(r.code ? `${r.code} - ${r.name}` : r.name);
  return out;
}
