import Link from "next/link";
import { notFound } from "next/navigation";
import { getChannelListing, channelsFor } from "@/lib/marketplace/listings";
import { CHANNEL_RULES } from "@/lib/marketplace/channels";
import type { Check } from "@/lib/marketplace/tiktok";
import { CopyButton } from "../../../CopyButton";
import { ChannelPreview } from "../../../ChannelPreview";

export const metadata = { title: "Anúncio por canal — MakeOne" };

const SEV: Record<Check["severity"], string> = { erro: "bg-red-50 text-red-700", aviso: "bg-amber-50 text-amber-700", pendencia: "bg-sky-50 text-sky-700" };
const SEV_L: Record<Check["severity"], string> = { erro: "Regra", aviso: "Aviso", pendencia: "Vendedor" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-0">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase text-muted-fg">{label}</div>
        <div className="whitespace-pre-line break-words text-sm text-ink">{value}</div>
      </div>
      <CopyButton text={value} />
    </div>
  );
}

export function generateStaticParams() {
  return channelsFor("hyper-petg-preto").map((canal) => ({ slug: "hyper-petg-preto", canal }));
}

export default function CanalPage({ params }: { params: { slug: string; canal: string } }) {
  const c = getChannelListing(params.slug, params.canal);
  if (!c) notFound();
  const { listing: l, rules, checks, summary, baseUrl, meta } = c;
  const failed = checks.filter((x) => !x.ok);
  const attrs = Object.entries(l.attributes);
  const outros = channelsFor(params.slug).filter((k) => k !== params.canal);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Link href={`/anuncios/${params.slug}`} className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-fg hover:text-ink">← Anúncio TikTok Shop</Link>
        <h1 className="display dot mt-2 text-[30px] leading-tight sm:text-[38px]">{rules.nome}</h1>
        <p className="mt-1 text-sm text-muted-fg">{l.title}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {outros.map((k) => (
            <Link key={k} href={`/anuncios/${params.slug}/canal/${k}`} className="chip border-line hover:border-ink">{CHANNEL_RULES[k].nome}</Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className={`rounded-2xl p-4 text-white shadow-soft ${summary.conteudoPronto ? "bg-emerald-600" : "bg-red-600"}`}>
          <div className="text-xs font-semibold opacity-80">Conteúdo × regras do canal</div>
          <div className="text-lg font-extrabold">{summary.conteudoPronto ? "Aprovado" : "Reprovado"}</div>
          <div className="text-xs opacity-80">{summary.passed}/{summary.total} verificações ok</div>
        </div>
        <div className="card p-4"><div className="text-xs text-muted-fg">Erros de regra</div><div className="text-2xl font-extrabold">{summary.erros}</div></div>
        <div className="card p-4"><div className="text-xs text-muted-fg">Avisos</div><div className="text-2xl font-extrabold">{summary.avisos}</div></div>
        <div className="card p-4"><div className="text-xs text-muted-fg">Pendências do vendedor</div><div className="text-2xl font-extrabold">{summary.pendencias}</div></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <ChannelPreview canal={l.canal} nome={rules.nome} l={l} baseUrl={baseUrl} />
          <section className="card p-5 sm:p-6">
            <h2 className="display mb-3 text-[20px]">Campos para colar</h2>
            <Row label={`Título (${l.title.length}/${rules.titleMax})`} value={l.title} />
            {l.bullets && <Row label={`Tópicos (${l.bullets.length})`} value={l.bullets.join("\n")} />}
            <Row label={`Descrição (${l.description.length}${rules.descMax ? `/${rules.descMax}` : ""})`} value={l.description} />
            {l.packaging && <Row label="Packaging" value={l.packaging} />}
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase text-muted-fg">{rules.idioma === "en" ? "Key attributes" : "Ficha técnica"}</span>
                <CopyButton text={attrs.map(([k, v]) => `${k}: ${v}`).join("\n")} label="Copiar todos" />
              </div>
              <table className="w-full text-sm"><tbody>
                {attrs.map(([k, v]) => (<tr key={k} className="border-b border-line last:border-0"><td className="py-1 pr-3 text-muted-fg">{k}</td><td className="py-1 font-medium">{v}</td></tr>))}
              </tbody></table>
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="display mb-3 text-[20px]">Imagens (ordem de upload)</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {l.images.map((im, k) => (
                <a key={im.file + k} href={`${baseUrl}/${im.file}`} download className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${baseUrl}/${im.file}`} alt="" className="aspect-square w-full rounded-xl border border-line object-cover" />
                  <div className="mt-1 text-[11px] leading-tight"><b>{k === 0 ? "1 · Principal" : `${k + 1}`}</b>
                    <div className="text-muted-fg">{meta[im.file]?.width}×{meta[im.file]?.height}{im.hasAddedText ? " · com texto" : ""}</div></div>
                </a>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="display mb-3 text-[20px]">Checklist</h2>
            {failed.length === 0 ? <p className="text-sm text-emerald-700">Tudo ok.</p> : (
              <ul className="space-y-1.5">
                {failed.map((x) => (
                  <li key={x.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${SEV[x.severity]}`}>{SEV_L[x.severity]}</span>
                    <span><b>{x.label}</b> — <span className="text-muted-fg">{x.detail}</span></span>
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-muted-fg">{checks.length - failed.length} verificações aprovadas</summary>
              <ul className="mt-2 space-y-1">{checks.filter((x) => x.ok).map((x) => (<li key={x.id} className="text-xs">✓ {x.label} <span className="text-muted-fg">({x.detail})</span></li>))}</ul>
            </details>
          </section>
          <section className="card p-5">
            <h2 className="display mb-2 text-[18px]">Regras usadas</h2>
            <ul className="space-y-1.5 text-xs text-muted-fg">{rules.fontes.map((f) => (<li key={f}>• {f}</li>))}</ul>
            <p className="mt-2 text-[11px] text-muted-fg">Levantado em 03/11/2026. Conferir no painel do canal antes de publicar.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
