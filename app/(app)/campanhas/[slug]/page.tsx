import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaign, campaignSlugs } from "@/lib/marketplace/listings";
import { AD_LIMITS, type AdPlatform } from "@/lib/marketplace/ads";
import { CopyButton } from "../../anuncios/CopyButton";

export const metadata = { title: "Campanha — Kairós" };
export function generateStaticParams() { return campaignSlugs().map((slug) => ({ slug })); }

const FMT_LABEL: Record<string, string> = { "1x1": "1:1", "4x5": "4:5", "9x16": "9:16", "191x1": "1,91:1" };

export default function CampanhaPage({ params }: { params: { slug: string } }) {
  const c = getCampaign(params.slug);
  if (!c) notFound();
  const failed = c.checks.filter((x) => !x.ok);
  const files = Object.keys(c.assets);
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div>
        <Link href="/campanhas" className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-fg hover:text-ink">← Campanhas</Link>
        <h1 className="display dot mt-2 text-[30px] leading-tight sm:text-[38px]">Campanha · {c.base.title.slice(0, 60)}</h1>
        <p className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${failed.length ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {failed.length ? `${failed.length} textos fora do limite` : `Todos os ${c.checks.length} textos dentro dos limites`}
        </p>
      </div>

      <section className="card grid gap-5 p-5 sm:grid-cols-[220px_1fr] sm:p-6">
        <video src={`/marketplace/${params.slug}/tiktok/ugc/ugc_video_9x16.mp4`} controls playsInline muted className="w-full rounded-xl bg-black" />
        <div>
          <h2 className="display text-[22px]">Vídeo UGC (9:16)</h2>
          <p className="mt-1 text-sm text-muted-fg">Pessoa usando o produto, com legenda em português e cartão final. Para Reels, Stories, TikTok e Shorts (Meta e Google).</p>
          <a href={`/marketplace/${params.slug}/tiktok/ugc/ugc_video_9x16.mp4`} download className="btn-secondary mt-3 inline-flex">Baixar vídeo</a>
          <p className="mt-3 text-xs text-muted-fg">Os criativos “ugc_maker” e “ugc_resultado” abaixo também são UGC, recortados nos 4 formatos.</p>
        </div>
      </section>
      {(Object.keys(AD_LIMITS) as AdPlatform[]).map((p) => {
        const L = AD_LIMITS[p];
        return (
          <section key={p} className="card p-5 sm:p-6">
            <h2 className="display text-[22px]">{L.nome}</h2>
            <ul className="mb-4 mt-1 space-y-0.5 text-[11px] text-muted-fg">{L.fontes.map((f) => <li key={f}>• {f}</li>)}</ul>
            <div className="grid gap-5 lg:grid-cols-2">
              {L.campos.map((f) => {
                const list = c.copy[p]?.[f.key] ?? [];
                return (
                  <div key={f.key}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase text-muted-fg">{f.label} · máx. {f.max} · {list.length} variações</span>
                      <CopyButton text={list.join("\n")} label="Copiar" />
                    </div>
                    <ul className="space-y-1">
                      {list.map((t) => (
                        <li key={t} className="flex items-start justify-between gap-2 rounded-lg bg-surface-muted px-3 py-1.5 text-sm">
                          <span>{t}</span>
                          <span className={`shrink-0 font-mono text-[10px] ${t.length > f.max ? "text-red-600" : "text-muted-fg"}`}>{t.length}/{f.max}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-semibold uppercase text-muted-fg">Criativos para {L.nome.split(" (")[0]}</div>
              <div className="flex flex-wrap items-end gap-3">
                {files.filter((f) => L.formatos.some((fmt) => f.endsWith(`_${fmt}.jpg`))).map((f) => {
                  const m = c.assets[f];
                  return (
                    <a key={f} href={`${c.adsUrl}/${f}`} download className="block w-32">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${c.adsUrl}/${f}`} alt="" style={{ aspectRatio: `${m.width}/${m.height}` }} className="w-full rounded-lg border border-line object-cover" />
                      <div className="mt-1 text-[10px] leading-tight text-muted-fg">{FMT_LABEL[f.split("_").pop()!.replace(".jpg", "")]} · {m.width}×{m.height}</div>
                    </a>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
