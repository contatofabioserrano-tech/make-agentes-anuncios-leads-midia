/**
 * Modelo de landing page de produto (padrão "Pulse+": escura, títulos grandes, rótulos mono, botões em pílula).
 * Qualquer empresa/produto vira um LandingData; a página /loja/[slug] só renderiza.
 */
import type { ListingBundle } from "./marketplace/listings";
import { safeUrl } from "./marketplace/listings";

export interface LandingCompany { name: string; logoUrl?: string | null; accent?: string | null; whatsapp?: string | null; siteUrl?: string | null; legal?: string | null }
export interface LandingImage { src: string; alt: string; label?: string }
export interface LandingData {
  slug: string;
  company: LandingCompany;
  brand: string;
  shortName: string;
  title: string;
  /** título do hero em 2 linhas: a 2ª fica na cor de destaque */
  headline: [string, string];
  intro: string;
  bullets: string[];
  price: number | null;
  cutout?: string | null;
  hero: LandingImage;
  gallery: LandingImage[];
  lifestyle?: LandingImage | null;
  wide?: LandingImage | null;
  /** fotos de pessoas usando e resultados (UGC) */
  ugc: LandingImage[];
  ugcVideo?: string | null;
  video?: string | null;
  attributes: [string, string][];
  faqs: { q: string; a: string }[];
  /** canais onde comprar: url null = "em breve" */
  buy: { canal: string; nome: string; url: string | null }[];
  watermark: string;
}

/** Landing da Kairós a partir do anúncio pronto (reaproveita fotos do anúncio e criativos das campanhas). */
export function landingFromListing(b: ListingBundle, company: LandingCompany, opts: { adsUrl?: string; hasCutout?: boolean; buy: LandingData["buy"]; faqs?: LandingData["faqs"]; ugc?: { file: string; alt: string; label?: string }[]; ugcVideo?: string | null }): LandingData {
  const l = b.listing;
  const img = (f: string) => `${b.baseUrl}/${f}`;
  const gal = l.images.filter((i) => i.role !== "descricao");
  const ads = opts.adsUrl;
  const short = l.attributes["Linha"] ? `${l.brand} ${l.attributes["Linha"]}` : l.title.split(" ").slice(0, 4).join(" ");
  return {
    slug: l.slug,
    company,
    brand: l.brand,
    shortName: short,
    title: l.title,
    headline: [`${short}.`, l.attributes["Velocidade de impressão"] ? `Rápido. Resistente.` : "Feito para durar."],
    intro: l.bullets[0] ?? "",
    bullets: l.bullets,
    price: l.price,
    cutout: opts.hasCutout && ads ? `${ads}/produto_recorte.png` : null,
    hero: { src: img(gal[0]?.file ?? ""), alt: gal[0]?.alt ?? l.title },
    gallery: gal.filter((g) => !g.file.startsWith("ugc/")).slice(1, 7).map((g) => ({ src: img(g.file), alt: g.alt, label: g.angle })),
    ugc: (opts.ugc ?? []).map((u) => ({ src: img(u.file), alt: u.alt, label: u.label })),
    ugcVideo: opts.ugcVideo ? img(opts.ugcVideo) : null,
    lifestyle: opts.ugc?.length ? { src: img("ugc/u7_ads_4x5.jpg"), alt: `${l.title} em uso` } : ads ? { src: `${ads}/uso_4x5.jpg`, alt: `${l.title} em uso` } : null,
    wide: ads ? { src: `${ads}/pecas_191x1.jpg`, alt: `Peças feitas com ${short}` } : null,
    video: l.videos.find((v) => v.role === "produto") ? img(l.videos.find((v) => v.role === "produto")!.file) : null,
    attributes: Object.entries(l.attributes),
    faqs: opts.faqs ?? [],
    buy: opts.buy.map((x) => ({ ...x, url: safeUrl(x.url) ?? null })),
    watermark: (l.attributes["Material"] ?? l.brand).toUpperCase(),
  };
}
