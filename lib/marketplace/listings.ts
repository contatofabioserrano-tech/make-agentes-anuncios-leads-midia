import type { AssetMeta, TikTokListing } from "./tiktok";
import { validateTikTokListing, summarize, composeDescription } from "./tiktok";
import hyperPetgPreto from "./data/hyper-petg-preto.json";
import hyperPetgPretoAssets from "@/public/marketplace/hyper-petg-preto/assets.json";
import hyperPetgPretoChannels from "./data/hyper-petg-preto.channels.json";
import hyperPetgPretoAds from "./data/hyper-petg-preto.ads.json";
import hyperPetgPretoAdsAssets from "@/public/marketplace/hyper-petg-preto/ads/assets.json";
import { validateAds, type AdCopy } from "./ads";
import { CHANNEL_RULES, validateChannel, summarizeChannel, type ChannelKey, type ChannelListing } from "./channels";

export interface FeedPackage {
  videoFile: string;
  caption: string;
  hashtags: string[];
  searchKeywords: string[];
  hooks: string[];
  script: { t: string; visual: string; fala: string; legenda: string }[];
  ctas: string[];
  creatorBrief: string[];
  postingPlan: string[];
  voice?: { provider: string; voz: string; modelo: string; texto: string };
}

type RawListing = Omit<TikTokListing, "description"> & { intro: string };

export interface ListingBundle {
  listing: TikTokListing;
  feed: FeedPackage;
  meta: Record<string, AssetMeta>;
  /** Pasta pública dos arquivos (servidos pelo Next em /marketplace/<slug>/tiktok/...). */
  baseUrl: string;
}

/**
 * Aceita só URLs seguras para renderizar: caminho relativo do próprio site ("/...", sem "//")
 * ou https. Bloqueia javascript:, data:, http: e afins (XSS por link).
 */
export function safeUrl(u: unknown): string | undefined {
  if (typeof u !== "string" || !u) return undefined;
  const s = u.trim();
  if (s.startsWith("/") && !s.startsWith("//") && !s.includes("\\")) return s;
  try {
    const x = new URL(s);
    return x.protocol === "https:" ? x.toString().replace(/\/$/, "") : undefined;
  } catch {
    return undefined;
  }
}

/** Nome de arquivo dentro da pasta do anúncio: sem esquema, sem "..", sem barra inicial. */
export function safeFile(f: unknown): string {
  const s = typeof f === "string" ? f : "";
  return /^[\w][\w./-]*$/.test(s) && !s.includes("..") ? s : "";
}

function build(raw: { listing: unknown; feed: unknown }, meta: unknown, baseUrl?: string): ListingBundle {
  const L = raw.listing as RawListing;
  const r: RawListing = { ...L, images: L.images ?? [], videos: L.videos ?? [], variations: L.variations ?? [], attributes: L.attributes ?? {} };
  const { intro: _intro, ...rest } = r;
  void _intro;
  const listing: TikTokListing = {
    ...rest,
    images: (rest.images ?? []).filter((i) => safeFile(i.file)),
    videos: (rest.videos ?? []).filter((v) => safeFile(v.file)),
    description: composeDescription(r),
  };
  return {
    listing,
    feed: { ...((raw.feed ?? {}) as FeedPackage), videoFile: safeFile((raw.feed as FeedPackage | undefined)?.videoFile) },
    meta: meta as Record<string, AssetMeta>,
    baseUrl: safeUrl(baseUrl) ?? `/marketplace/${safeFile(r.slug) || "x"}/tiktok`,
  };
}

export const LISTINGS: ListingBundle[] = [build(hyperPetgPreto, hyperPetgPretoAssets)];

export function getListing(slug: string): ListingBundle | undefined {
  return LISTINGS.find((b) => b.listing.slug === slug);
}

export function evaluate(b: ListingBundle) {
  const checks = validateTikTokListing(b.listing, b.meta);
  return { checks, summary: summarize(checks) };
}

/**
 * Resolve um anúncio pelo slug: os fixos do repositório ou os gerados pelo agente
 * ("job-<uuid>", lidos de mk_ad_jobs.result.bundle — arquivos no Storage público).
 */
export async function resolveListing(
  slug: string,
  supabase: { from: (t: string) => unknown },
): Promise<ListingBundle | undefined> {
  if (!slug.startsWith("job-")) return getListing(slug);
  type Q = { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { result?: { bundle?: { listing?: unknown; feed?: unknown; meta?: unknown; baseUrl?: string } } } | null }> } } };
  const { data } = await (supabase.from("mk_ad_jobs") as Q).select("id,status,result").eq("id", slug.slice(4)).maybeSingle();
  const bundle = data?.result?.bundle;
  if (!bundle?.listing) return undefined;
  return build({ listing: bundle.listing, feed: bundle.feed ?? {} }, bundle.meta ?? {}, bundle.baseUrl);
}

const CHANNELS: Record<string, Record<ChannelKey, ChannelListing>> = {
  "hyper-petg-preto": hyperPetgPretoChannels as unknown as Record<ChannelKey, ChannelListing>,
};

/** Anúncio de um canal (ML, Shopee, Amazon, Magalu, Alibaba) já validado contra as regras do canal. */
export function getChannelListing(slug: string, canal: string) {
  const base = getListing(slug);
  const rules = CHANNEL_RULES[canal as ChannelKey];
  const l = CHANNELS[slug]?.[canal as ChannelKey];
  if (!base || !rules || !l) return undefined;
  const merged: ChannelListing = { ...l, price: l.price ?? base.listing.price };
  const checks = validateChannel(merged, base.meta);
  return { listing: merged, rules, checks, summary: summarizeChannel(checks), baseUrl: base.baseUrl, meta: base.meta, base: base.listing };
}

export function channelsFor(slug: string): ChannelKey[] {
  return Object.keys(CHANNELS[slug] ?? {}) as ChannelKey[];
}

const ADS: Record<string, { copy: AdCopy; assets: Record<string, { width: number; height: number; bytes: number; modo: string }> }> = {
  "hyper-petg-preto": { copy: hyperPetgPretoAds as AdCopy, assets: hyperPetgPretoAdsAssets },
};

/** Campanha (textos + criativos) de um anúncio, já validada contra os limites de cada plataforma. */
export function getCampaign(slug: string) {
  const base = getListing(slug);
  const a = ADS[slug];
  if (!base || !a) return undefined;
  const checks = validateAds(a.copy);
  return { base: base.listing, copy: a.copy, assets: a.assets, checks, adsUrl: `/marketplace/${slug}/ads` };
}

export function campaignSlugs(): string[] {
  return Object.keys(ADS);
}
