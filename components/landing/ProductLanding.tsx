import type { LandingData } from "@/lib/landing";
import { Viewer } from "./Viewer";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pad = (n: number) => String(n).padStart(2, "0");

function Eyebrow({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <p className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#A4B6D0]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} /> {children}
    </p>
  );
}

function Pill({ href, children, solid, accent }: { href: string; children: React.ReactNode; solid?: boolean; accent: string }) {
  return (
    <a href={href} className={`inline-flex items-center gap-3 rounded-full px-6 py-3.5 text-[12px] font-semibold uppercase tracking-[0.06em] transition ${solid ? "text-white hover:brightness-110" : "border border-white/20 text-white hover:border-white/60"}`}
      style={solid ? { background: accent } : undefined}>
      {children} <span aria-hidden>↗</span>
    </a>
  );
}

function Big({ a, b, accent, as: Tag = "h2", size = "text-[44px] sm:text-[64px] lg:text-[76px]" }: { a: string; b: string; accent: string; as?: "h1" | "h2"; size?: string }) {
  return (
    <Tag className={`${size} font-normal leading-[0.98] tracking-[-0.055em] text-white`}>
      {a}<br /><span style={{ color: accent }}>{b}</span>
    </Tag>
  );
}

/**
 * Landing page de produto, página única, no padrão Pulse+ (escura, tipografia grande, mono nos rótulos).
 * Logo e cor de destaque vêm da empresa. Imagens reaproveitam o anúncio e os criativos das campanhas.
 */
export function ProductLanding({ d, lead, form }: { d: LandingData; lead?: string; form: React.ReactNode }) {
  const accent = d.company.accent || "#3B52FF";
  const disponiveis = d.buy.filter((b) => b.url);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: d.title, brand: { "@type": "Brand", name: d.brand },
    image: [d.hero.src, ...d.gallery.map((g) => g.src)], description: d.intro,
    ...(d.price ? { offers: { "@type": "Offer", priceCurrency: "BRL", price: d.price.toFixed(2), availability: "https://schema.org/InStock" } } : {}),
  };
  const nav = [["#produto", "Produto"], ["#detalhes", "Detalhes"], ["#ficha", "Ficha técnica"], ["#duvidas", "Dúvidas"], ["#comprar", "Onde comprar"]];

  return (
    <div className="min-h-screen bg-[#080B10] font-sans text-[#F5F7FF] antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* faixa de aviso */}
      <div className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white" style={{ background: accent }}>
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4">
          <span className="truncate">{d.shortName}{d.price ? ` · ${brl(d.price)}` : ""} · {disponiveis.length ? `disponível em ${disponiveis.map((x) => x.nome).join(", ")}` : "atacado e varejo"}</span>
          <a href="#comprar" className="shrink-0 hover:underline">Onde comprar ↗</a>
        </div>
      </div>

      {/* cabeçalho fixo com o logo da empresa */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#05070A]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#produto" className="flex min-w-0 items-center gap-3">
            {d.company.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={d.company.logoUrl} alt={d.company.name} className="h-8 w-auto max-w-[140px] object-contain" />
              : <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: accent }}>{d.company.name[0]}</span>}
            <span className="truncate text-sm font-semibold uppercase tracking-[0.04em]">{d.company.name}</span>
          </a>
          <nav className="hidden items-center gap-6 text-[11px] font-medium uppercase tracking-[0.06em] text-white/80 lg:flex" aria-label="Seções">
            {nav.map(([h, t]) => <a key={h} href={h} className="hover:text-white">{t}</a>)}
          </nav>
          <a href="#comprar" className="rounded-full px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white" style={{ background: accent }}>Comprar ↗</a>
        </div>
      </header>

      <main>
        {/* hero */}
        <section id="produto" className="relative overflow-hidden bg-[#050A13]">
          <div className="pointer-events-none absolute right-[-10%] top-[-10%] h-[700px] w-[700px] rounded-full opacity-30 blur-[120px]" style={{ background: accent }} />
          <div className="relative mx-auto grid max-w-[1320px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-24">
            <div>
              <Eyebrow accent={accent}>{d.brand} · {d.company.name}</Eyebrow>
              <Big as="h1" a={d.headline[0]} b={d.headline[1]} accent={accent} size="text-[48px] sm:text-[80px] lg:text-[96px]" />
              <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-white/75">{d.intro}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Pill href="#comprar" solid accent={accent}>Quero o meu</Pill>
                <Pill href="#detalhes" accent={accent}>Veja os detalhes</Pill>
              </div>
              <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-[#A4B6D0]">
                {d.price ? `A partir de ${brl(d.price)}` : "Preço sob consulta"} · {d.title.length > 60 ? `${d.title.slice(0, 60)}…` : d.title}
              </p>
            </div>
            <div className="relative mx-auto w-full max-w-[520px]">
              {d.cutout
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={d.cutout} alt={d.hero.alt} className="relative mx-auto max-h-[560px] w-auto drop-shadow-[0_40px_60px_rgba(0,0,0,0.6)]" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={d.hero.src} alt={d.hero.alt} className="w-full rounded-[32px]" />}
            </div>
          </div>
          <div className="relative mx-auto flex max-w-[1320px] flex-wrap gap-x-8 gap-y-2 border-t border-white/[0.06] px-4 py-5 sm:px-6">
            {d.bullets.slice(0, 3).map((b, k) => (
              <span key={b} className="text-[12px] text-white/60"><span className="mr-2 font-mono text-white/40">{pad(k + 1)}</span>{b.split(":")[0]}</span>
            ))}
          </div>
        </section>

        {/* coleção / cards */}
        <section id="detalhes" className="bg-[#0B1017] py-20 sm:py-28">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
            <Eyebrow accent={accent}>Por dentro do produto</Eyebrow>
            <Big a="Feito para o seu uso." b="Do jeito certo." accent={accent} />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {d.bullets.slice(0, 3).map((b, k) => {
                const [t, ...rest] = b.split(":");
                const im = d.gallery[k];
                return (
                  <article key={b} className="flex flex-col overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.02]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {im && <img src={im.src} alt={im.alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
                    <div className="flex flex-1 flex-col p-6">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A4B6D0]">{pad(k + 1)} · {rest.length ? t : d.brand}</p>
                      <p className="mt-3 flex-1 text-[15px] leading-relaxed text-white/75">{rest.length ? rest.join(":").trim() : b}</p>
                      <a href="#comprar" className="mt-6 inline-flex w-max items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold uppercase text-white" style={{ background: accent }}>Comprar ↗</a>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* manifesto */}
        <section className="bg-[#0E1622] py-20 sm:py-24">
          <div className="mx-auto grid max-w-[1320px] gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <Big a={`${d.shortName.split(" ")[0]} entrega.`} b="Você produz." accent={accent} size="text-[40px] sm:text-[56px]" />
            <div>
              <p className="text-[19px] leading-relaxed text-white/85">{d.bullets[1] ?? d.intro}</p>
              <p className="mt-5 text-[15px] leading-relaxed text-white/60">{d.bullets.slice(2, 4).join(" ")}</p>
              <a href="#ficha" className="mt-6 inline-flex items-center gap-2 border-b border-white/30 pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white/80">Ver ficha técnica ↗</a>
            </div>
          </div>
        </section>

        {/* uso real + vídeo */}
        {(d.lifestyle || d.video) && (
          <section className="relative overflow-hidden bg-[#080D15] py-20 sm:py-28">
            <p aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center text-[22vw] font-semibold leading-none tracking-[-0.06em] text-white/[0.03]">{d.watermark}</p>
            <div className="relative mx-auto grid max-w-[1320px] items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
              <div>
                <Eyebrow accent={accent}>Na prática</Eyebrow>
                <Big a="Do rolo." b="À peça pronta." accent={accent} />
                <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-white/70">{d.bullets[2] ?? d.intro}</p>
                <div className="mt-8"><Pill href="#comprar" solid accent={accent}>Quero esse resultado</Pill></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {d.lifestyle && <img src={d.lifestyle.src} alt={d.lifestyle.alt} loading="lazy" className="col-span-1 w-full rounded-[22px] object-cover" />}
                {d.video ? <video src={d.video} controls playsInline preload="metadata" className="w-full rounded-[22px] bg-black" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : d.gallery[3] && <img src={d.gallery[3].src} alt={d.gallery[3].alt} className="w-full rounded-[22px]" />}
              </div>
            </div>
          </section>
        )}

        {/* pessoas usando (UGC) */}
        {d.ugc.length > 0 && (
          <section className="bg-[#0B1017] py-20 sm:py-28">
            <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
              <Eyebrow accent={accent}>Na mão de quem produz</Eyebrow>
              <Big a="Do maker" b="ao pequeno negócio." accent={accent} />
              <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {d.ugcVideo && (
                  <video src={d.ugcVideo} controls playsInline muted loop preload="metadata" className="aspect-[9/16] w-full rounded-[22px] bg-black object-cover sm:row-span-2" />
                )}
                {d.ugc.map((u) => (
                  <figure key={u.src} className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.02]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u.src} alt={u.alt} loading="lazy" className="aspect-square w-full object-cover" />
                    <figcaption className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#A4B6D0]">{u.label}</figcaption>
                  </figure>
                ))}
              </div>
              <p className="mt-4 text-xs text-white/40">Imagens ilustrativas de uso, criadas a partir da foto real do produto.</p>
            </div>
          </section>
        )}

        {/* ponto de vista */}
        {d.gallery.length > 0 && (
          <section className="bg-[#0C131D] py-20 sm:py-28">
            <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
              <Eyebrow accent={accent}>Explore cada ângulo</Eyebrow>
              <Big a="Um novo" b="ponto de vista." accent={accent} />
              <div className="mt-12"><Viewer images={d.gallery} accent={accent} /></div>
            </div>
          </section>
        )}

        {/* ficha técnica */}
        <section id="ficha" className="bg-[#080D14] py-20 sm:py-28">
          <div className="mx-auto grid max-w-[1320px] gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <Eyebrow accent={accent}>Ficha técnica</Eyebrow>
              <Big a="Os números." b="Sem enrolação." accent={accent} size="text-[40px] sm:text-[56px]" />
              {d.wide && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.wide.src} alt={d.wide.alt} loading="lazy" className="mt-10 w-full rounded-[22px]" />
              )}
            </div>
            <dl className="divide-y divide-white/[0.07] rounded-[22px] border border-white/[0.08] bg-white/[0.02] px-6">
              {d.attributes.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-6 py-4">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#A4B6D0]">{k}</dt>
                  <dd className="text-right text-[15px] text-white">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* onde comprar */}
        <section id="comprar" className="bg-[#0D1521] py-20 sm:py-28">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
            <Eyebrow accent={accent}>Onde comprar</Eyebrow>
            <Big a="Escolha onde." b="Receba em casa." accent={accent} />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {d.buy.map((b) => (
                <div key={b.canal} className="flex items-center justify-between gap-4 rounded-[22px] border border-white/[0.08] bg-white/[0.02] p-6">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A4B6D0]">{b.url ? "Disponível" : "Em breve"}</p>
                    <p className="mt-1 text-[20px] tracking-[-0.02em] text-white">{b.nome}</p>
                    {d.price && <p className="mt-1 text-sm text-white/60">{brl(d.price)}</p>}
                  </div>
                  {b.url
                    ? <a href={b.url} target="_blank" rel="noopener noreferrer" className="rounded-full px-5 py-3 text-[11px] font-semibold uppercase text-white" style={{ background: accent }}>Comprar ↗</a>
                    : <a href="#contato" className="rounded-full border border-white/20 px-5 py-3 text-[11px] font-semibold uppercase text-white/80">Avise-me</a>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* dúvidas */}
        {d.faqs.length > 0 && (
          <section id="duvidas" className="bg-[#080D15] py-20 sm:py-28">
            <div className="mx-auto grid max-w-[1320px] gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <Eyebrow accent={accent}>Dúvidas frequentes</Eyebrow>
                <Big a="Uma pausa" b="para as dúvidas." accent={accent} size="text-[40px] sm:text-[56px]" />
              </div>
              <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
                {d.faqs.map((f, k) => (
                  <details key={f.q} className="group py-5">
                    <summary className="flex cursor-pointer list-none items-center gap-5 text-[18px] text-white">
                      <span className="font-mono text-[11px] text-[#A4B6D0]">{pad(k + 1)}</span>
                      <span className="flex-1">{f.q}</span>
                      <span className="text-white/50 transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-3 pl-10 text-[15px] leading-relaxed text-white/70">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* contato */}
        <section id="contato" className="bg-[#0E1622] py-20 sm:py-28">
          <div className="mx-auto grid max-w-[1320px] gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <Eyebrow accent={accent}>Atacado e revenda</Eyebrow>
              <Big a="Fale com a" b={`${d.company.name}.`} accent={accent} size="text-[40px] sm:text-[60px]" />
              <p className="mt-6 max-w-md text-[16px] leading-relaxed text-white/70">Deixe seu contato. A equipe responde com preço, prazo e condições para revenda.</p>
              {lead === "ok" && <p role="status" className="mt-6 rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300">Recebemos seu contato. Obrigado!</p>}
              {lead === "erro" && <p role="alert" className="mt-6 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-300">Confira nome e e-mail ou telefone e tente de novo.</p>}
            </div>
            {form}
          </div>
        </section>

        {/* chamada final */}
        <section className="bg-[#050A13] py-24 text-center">
          <Big a="Pronto para começar?" b={`${d.shortName}.`} accent={accent} size="text-[40px] sm:text-[72px]" />
          <div className="mt-10"><Pill href="#comprar" solid accent={accent}>Ver onde comprar</Pill></div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] bg-[#05070A] px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-[1320px] gap-8 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {d.company.logoUrl && <img src={d.company.logoUrl} alt="" className="h-8 w-auto max-w-[120px] object-contain" />}
            <span className="text-sm font-semibold uppercase">{d.company.name}</span>
          </div>
          <ul className="space-y-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">
            {nav.map(([h, t]) => <li key={h}><a href={h} className="hover:text-white">{t}</a></li>)}
          </ul>
          <div className="space-y-2 text-sm text-white/60">
            {d.company.siteUrl && <a href={d.company.siteUrl} className="block hover:text-white">{d.company.siteUrl.replace(/^https:\/\//, "")}</a>}
            {d.company.whatsapp && <a href={`https://wa.me/55${d.company.whatsapp.replace(/\D/g, "").replace(/^55/, "")}`} className="block hover:text-white">WhatsApp</a>}
            {d.company.legal && <p className="text-xs text-white/40">{d.company.legal}</p>}
            <a href="#produto" className="inline-block font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">Voltar ao topo ↑</a>
          </div>
        </div>
      </footer>

      {/* botão fixo no celular */}
      <a href="#comprar" className="fixed inset-x-4 bottom-4 z-40 rounded-full py-3.5 text-center text-[12px] font-semibold uppercase tracking-[0.06em] text-white shadow-2xl sm:hidden" style={{ background: accent }}>
        Comprar {d.price ? `· ${brl(d.price)}` : ""}
      </a>
    </div>
  );
}
