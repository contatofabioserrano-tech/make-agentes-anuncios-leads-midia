import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveListing, evaluate, safeUrl, channelsFor } from "@/lib/marketplace/listings";
import { CHANNEL_RULES } from "@/lib/marketplace/channels";
import { createClient } from "@/lib/supabase/server";
import type { Check } from "@/lib/marketplace/tiktok";
import { CopyButton } from "../CopyButton";
import { Gallery } from "../Gallery";
import { PriceCalculator } from "../PriceCalculator";

export const dynamic = "force-dynamic";

export const metadata = { title: "Anúncio TikTok Shop — MakeOne" };

const SEV_STYLE: Record<Check["severity"], string> = {
  erro: "bg-red-50 text-red-700",
  aviso: "bg-amber-50 text-amber-700",
  pendencia: "bg-sky-50 text-sky-700",
};
const SEV_LABEL: Record<Check["severity"], string> = { erro: "Política", aviso: "Aviso", pendencia: "Vendedor" };

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="display text-[20px]">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-black/5 py-2 last:border-0">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase text-muted-fg">{label}</div>
        <div className="whitespace-pre-line break-words text-sm text-ink">{value}</div>
      </div>
      <CopyButton text={value} />
    </div>
  );
}

export default async function AnuncioPage({ params }: { params: { slug: string } }) {
  const bundle = await resolveListing(params.slug, createClient());
  if (!bundle) notFound();
  const { listing: l, feed, baseUrl, meta } = bundle;
  const { checks, summary } = evaluate(bundle);
  const gallery = l.images.filter((i) => i.role !== "descricao");
  const descImages = l.images.filter((i) => i.role === "descricao");
  const productVideo = l.videos.find((v) => v.role === "produto");
  const failed = checks.filter((c) => !c.ok);
  const fob = l.costFobBrl ?? 0;
  const attrs = Object.entries(l.attributes);
  const hashtags = (feed.hashtags ?? []).join(" ");

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/anuncios" className="text-xs font-semibold text-brand-violet">← Anúncios</Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">TikTok Shop · {l.title.length > 80 ? `${l.title.slice(0, 80)}…` : l.title}</h1>
          <p className="mt-1 text-sm text-muted-fg">
            SKU {l.sku}{l.odooId ? ` · Odoo #${l.odooId}` : ""} · validado contra a Política de Listagem do TikTok Shop Brasil (28/10/2026)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {channelsFor(params.slug).map((k) => (
            <Link key={k} href={`/anuncios/${params.slug}/canal/${k}`} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold">{CHANNEL_RULES[k].nome}</Link>
          ))}
          <a href={`/anuncios/${encodeURIComponent(params.slug)}/export?format=csv`} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold">Exportar CSV</a>
          <a href={`/anuncios/${encodeURIComponent(params.slug)}/export?format=json`} className="rounded-xl bg-brand-gradient px-3 py-2 text-sm font-semibold text-white shadow-soft">Exportar JSON</a>
        </div>
      </div>

      {/* Status */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className={`rounded-2xl p-4 shadow-soft ${summary.conteudoPronto ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
          <div className="text-xs font-semibold opacity-80">Conteúdo × política</div>
          <div className="text-lg font-extrabold">{summary.conteudoPronto ? "Aprovado" : "Reprovado"}</div>
          <div className="text-xs opacity-80">{summary.passed}/{summary.total} verificações ok</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <div className="text-xs font-semibold text-muted-fg">Erros de política</div>
          <div className="text-2xl font-extrabold text-ink">{summary.erros}</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <div className="text-xs font-semibold text-muted-fg">Avisos</div>
          <div className="text-2xl font-extrabold text-ink">{summary.avisos}</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <div className="text-xs font-semibold text-muted-fg">Pendências do vendedor</div>
          <div className="text-2xl font-extrabold text-ink">{summary.pendencias}</div>
          <div className="text-[11px] text-muted-fg">preço, estoque, caixa, marca</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Prévia no formato da página de produto do TikTok Shop */}
        <div className="space-y-4">
          <div className="rounded-[2rem] border-8 border-ink bg-[#F8F8F8] p-3 shadow-soft-lg">
            {gallery.length > 0 ? <Gallery
              images={gallery.map((g, k) => ({
                src: `${baseUrl}/${g.file}`,
                alt: g.alt,
                tag: k === 0 ? "Principal · foto real" : g.aiGenerated ? "Cena ilustrativa" : undefined,
              }))}
            /> : <div className="flex aspect-square items-center justify-center rounded-2xl bg-white text-xs text-muted-fg">Sem imagens na galeria</div>}
            <div className="mt-3 space-y-2 rounded-2xl bg-white p-3">
              <div className="text-xl font-extrabold text-[#FE2C55]">
                {l.price ? l.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ —,—"}
                {!l.price && <span className="ml-2 align-middle text-[11px] font-semibold text-muted-fg">preço a definir</span>}
              </div>
              <h3 className="text-sm font-semibold leading-snug text-ink">{l.title}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-fg">
                <span>{l.variationStyle}:</span>
                {l.variations.map((v) => (
                  <span key={v.sku} className="rounded-md border border-ink px-2 py-0.5 font-semibold text-ink">{v.value}</span>
                ))}
              </div>
              <button type="button" disabled className="mt-1 w-full rounded-xl bg-[#FE2C55] py-2.5 text-sm font-bold text-white opacity-90">
                Comprar agora
              </button>
            </div>
            <details className="mt-3 rounded-2xl bg-white p-3 text-xs text-ink">
              <summary className="cursor-pointer font-semibold">Descrição do produto</summary>
              <p className="mt-2 whitespace-pre-line leading-relaxed">{l.description}</p>
              <div className="mt-2 grid grid-cols-1 gap-1.5">
                {descImages.map((d) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={d.file} src={`${baseUrl}/${d.file}`} alt={d.alt} className="rounded-lg" />
                ))}
              </div>
            </details>
          </div>

          {productVideo && (
            <Card title="Vídeo do anúncio" right={<a className="text-xs font-semibold text-brand-violet" href={`${baseUrl}/${productVideo.file}`} download>Baixar</a>}>
              <video src={`${baseUrl}/${productVideo.file}`} controls playsInline className="mx-auto max-h-[480px] rounded-xl bg-black" />
              <p className="mt-2 text-xs text-muted-fg">
                {meta[productVideo.file] ? `${(meta[productVideo.file].bytes / 1024 / 1024).toFixed(2)} MB · ${meta[productVideo.file].durationSec}s · ${meta[productVideo.file].width}×${meta[productVideo.file].height}` : ""}
                {" "}· limite do TikTok Shop: 1 vídeo de até 5 MB
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Checklist da política" right={<span className="text-xs text-muted-fg">{failed.length ? `${failed.length} itens abertos` : "tudo ok"}</span>}>
            {failed.length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {failed.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${SEV_STYLE[c.severity]}`}>{SEV_LABEL[c.severity]}</span>
                    <span><b>{c.label}</b> — <span className="text-muted-fg">{c.detail}</span></span>
                  </li>
                ))}
              </ul>
            )}
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-muted-fg">Ver as {checks.length - failed.length} verificações aprovadas</summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {checks.filter((c) => c.ok).map((c) => (
                  <li key={c.id} className="text-xs text-ink">✓ {c.label} <span className="text-muted-fg">({c.detail})</span></li>
                ))}
              </ul>
            </details>
          </Card>

          <Card title="Campos para colar no Seller Center">
            <CopyRow label={`Título (${l.title.length}/200 caracteres)`} value={l.title} />
            <CopyRow label="Categoria (confirmar a árvore exata no Seller Center)" value={l.category} />
            <CopyRow label="Marca" value={l.brand} />
            <CopyRow label={`Variação · ${l.variationStyle}`} value={l.variations.map((v) => `${v.value} (SKU ${v.sku})`).join("\n")} />
            <CopyRow label={`Descrição (${l.description.length} caracteres)`} value={l.description} />
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase text-muted-fg">Atributos</span>
                <CopyButton text={attrs.map(([k, v]) => `${k}: ${v}`).join("\n")} label="Copiar todos" />
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {attrs.map(([k, v]) => (
                    <tr key={k} className="border-b border-black/5 last:border-0">
                      <td className="py-1 pr-3 text-muted-fg">{k}</td>
                      <td className="py-1 font-medium text-ink">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Imagens do anúncio (ordem de upload)">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {l.images.map((im, k) => (
                <a key={im.file} href={`${baseUrl}/${im.file}`} download className="group block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${baseUrl}/${im.file}`} alt={im.alt} className="aspect-square w-full rounded-xl border border-black/5 object-cover" />
                  <div className="mt-1 text-[11px] leading-tight text-ink">
                    <b>{im.role === "descricao" ? "Descrição" : k === 0 ? "1 · Principal" : `${k + 1} · Galeria`}</b>
                    <div className="text-muted-fg">{meta[im.file]?.width}×{meta[im.file]?.height} · {im.aiGenerated ? "IA" : "foto real"}{im.hasAddedText ? " · com texto" : ""}</div>
                  </div>
                </a>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-fg">
              Galeria sem nenhum texto/selo (regra do TikTok Shop). As imagens com texto — ficha de configuração, destaques e as
              4 imagens de dúvidas (compatibilidade, PETG ou PLA, como guardar, o que vem na embalagem) — vão no corpo da
              descrição, onde a política permite guias e instruções de uso.
            </p>
          </Card>

          {feed.caption && (
          <Card title="Pacote para viralizar" right={feed.videoFile ? <a className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent" href={`${baseUrl}/${feed.videoFile}`} download>Baixar vídeo 1080p ↗</a> : undefined}>
            <div className="grid gap-5 md:grid-cols-[220px_1fr]">
              {feed.videoFile ? <video src={`${baseUrl}/${feed.videoFile}`} controls playsInline className="w-full rounded-xl bg-black" />
                : <div className="flex aspect-[9/16] items-center justify-center rounded-xl bg-[#E9E9E3] p-4 text-center text-xs text-muted-fg">Vídeo não solicitado neste job</div>}
              <div className="space-y-4">
                <CopyRow label="Legenda do post + hashtags" value={`${feed.caption}\n\n${hashtags}`} />
                {feed.voice && (
                  <p className="text-xs text-muted-fg">
                    Locução: <b className="text-ink">{feed.voice.voz}</b> · {feed.voice.provider} {feed.voice.modelo}
                  </p>
                )}
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase text-muted-fg">Ganchos (0–2 s) — testar 1 por vídeo</div>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
                    {(feed.hooks ?? []).map((h) => (<li key={h}>{h}</li>))}
                  </ol>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase text-muted-fg">CTAs</div>
                  <ul className="space-y-1 text-sm text-ink">{(feed.ctas ?? []).map((c) => (<li key={c}>→ {c}</li>))}</ul>
                </div>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto">
              <div className="mb-1 text-[11px] font-semibold uppercase text-muted-fg">Roteiro do comercial (18 s · uso real)</div>
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase text-muted-fg"><tr><th className="py-1 pr-3">Tempo</th><th className="pr-3">Imagem</th><th className="pr-3">Locução</th><th>Legenda</th></tr></thead>
                <tbody>
                  {(feed.script ?? []).map((s) => (
                    <tr key={s.t} className="border-t border-black/5"><td className="py-1.5 pr-3 font-semibold">{s.t}</td><td className="pr-3 text-muted-fg">{s.visual}</td><td className="pr-3">{s.fala}</td><td className="font-semibold">{s.legenda}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase text-muted-fg">Palavras-chave de busca (SEO do TikTok Shop)</span>
                  <CopyButton text={(feed.searchKeywords ?? []).join(", ")} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(feed.searchKeywords ?? []).map((k) => (<span key={k} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink">{k}</span>))}
                </div>
                <div className="mb-1 mt-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase text-muted-fg">Hashtags</span>
                  <CopyButton text={hashtags} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(feed.hashtags ?? []).map((h) => (<span key={h} className="rounded-full bg-[#25F4EE]/15 px-2.5 py-1 text-xs font-semibold text-ink">{h}</span>))}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase text-muted-fg">Briefing para criadores/afiliados</div>
                  <ul className="space-y-1 text-sm text-ink">{(feed.creatorBrief ?? []).map((c) => (<li key={c}>• {c}</li>))}</ul>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase text-muted-fg">Plano de postagem</div>
                  <ul className="space-y-1 text-sm text-ink">{(feed.postingPlan ?? []).map((c) => (<li key={c}>• {c}</li>))}</ul>
                </div>
              </div>
            </div>
          </Card>

          )}

          <Card title="Preço e margem">
            {l.marketPrices && (
              <div className="mb-4">
                <div className="mb-1 text-[11px] font-semibold uppercase text-muted-fg">
                  Referência de mercado · consultado em {l.marketPrices.consultadoEm.split("-").reverse().join("/")}
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {l.marketPrices.itens.map((m) => (
                      <tr key={m.loja + m.produto} className="border-b border-black/5 last:border-0">
                        <td className="py-1 pr-2"><a href={safeUrl(m.url) ?? "#"} target="_blank" rel="noreferrer" className="font-medium text-ink underline decoration-black/20">{m.loja}</a><div className="text-[11px] text-muted-fg">{m.produto}</div></td>
                        <td className="py-1 pr-2 text-right font-bold">{m.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                        <td className="py-1 text-right text-[11px] text-muted-fg">{m.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-[11px] text-muted-fg">{l.marketPrices.nota}</p>
              </div>
            )}
            <PriceCalculator fobBrl={fob} />
          </Card>
        </div>
      </div>
    </div>
  );
}
