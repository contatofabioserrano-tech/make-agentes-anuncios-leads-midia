import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getListing, channelsFor } from "@/lib/marketplace/listings";
import { CHANNEL_RULES, type ChannelKey } from "@/lib/marketplace/channels";
import { landingFromListing, type LandingCompany } from "@/lib/landing";
import { ProductLanding } from "@/components/landing/ProductLanding";
import { createClient } from "@/lib/supabase/server";
import hyperAdsAssets from "@/public/marketplace/hyper-petg-preto/ads/assets.json";
import hyperData from "@/lib/marketplace/data/hyper-petg-preto.json";
import hyperAssets from "@/public/marketplace/hyper-petg-preto/assets.json";
import { sendLead } from "./actions";

// dinâmica: a mensagem do formulário (?lead=ok|erro) depende da URL
export const dynamic = "force-dynamic";

/** Produto -> empresa dona e links reais de compra (preencher quando o anúncio for publicado). */
const PRODUCTS: Record<string, { company: string; faqs: { q: string; a: string }[]; buy: Partial<Record<ChannelKey | "tiktok_shop", string>>; hasCutout: boolean }> = {
  "hyper-petg-preto": { company: "kairos", faqs: (hyperData as { faqs?: { q: string; a: string }[] }).faqs ?? [], buy: {}, hasCutout: "produto_recorte.png" in hyperAdsAssets },
};

async function companyOf(slug: string): Promise<LandingCompany & { id?: string }> {
  const { data } = await createClient().from("mk_companies_public").select("id,name,logo_url,color_accent,whatsapp,site_url").eq("slug", slug).maybeSingle();
  return data
    ? { id: data.id, name: data.name, logoUrl: data.logo_url, accent: data.color_accent, whatsapp: data.whatsapp, siteUrl: data.site_url }
    : { name: "Grupo Kairós", accent: "#E11C24", siteUrl: null };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const b = getListing(params.slug);
  if (!b) return {};
  const c = await companyOf(PRODUCTS[params.slug]?.company ?? "kairos");
  return {
    title: `${b.listing.title} — ${c.name}`,
    description: b.listing.bullets[0],
    openGraph: { title: b.listing.title, images: [`/marketplace/${params.slug}/ads/principal_191x1.jpg`] },
  };
}

export default async function LojaPage({ params, searchParams }: { params: { slug: string }; searchParams: { lead?: string } }) {
  const b = getListing(params.slug);
  const cfg = PRODUCTS[params.slug];
  if (!b || !cfg) notFound();
  const company = await companyOf(cfg.company);
  const canais: (ChannelKey | "tiktok_shop")[] = ["tiktok_shop", ...channelsFor(params.slug).filter((k) => k !== "alibaba")];
  const d = landingFromListing(b, company, {
    adsUrl: `/marketplace/${params.slug}/ads`,
    hasCutout: cfg.hasCutout,
    faqs: cfg.faqs,
    ugc: [
      { file: "ugc/u1_maker_segurando.jpg", alt: "Maker com o rolo ao lado da impressora", label: "Maker em casa" },
      { file: "ugc/u2_carregando_impressora.jpg", alt: "Colocando o rolo na impressora", label: "Pronto em segundos" },
      { file: "ugc/u3_resultado_pecas.jpg", alt: "Peças funcionais impressas em PETG", label: "Resultado" },
      { file: "ugc/u4_pecas_em_uso.jpg", alt: "Peças em uso no dia a dia", label: "No dia a dia" },
      { file: "ugc/u5_unboxing.jpg", alt: "Rolo embalado a vácuo com sílica", label: "Unboxing" },
      { file: "ugc/u6_pequeno_negocio.jpg", alt: "Pequeno negócio de impressão 3D", label: "Pequeno negócio" },
    ],
    ugcVideo: "ugc/ugc_video_9x16.mp4" in hyperAssets ? "ugc/ugc_video_9x16.mp4" : null,
    buy: canais.map((k) => ({ canal: k, nome: k === "tiktok_shop" ? "TikTok Shop" : CHANNEL_RULES[k].nome, url: cfg.buy[k] ?? null })),
  });

  const field = "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder:text-white/30 outline-none focus:border-white/40";
  const form = (
    <form action={sendLead} className="grid gap-4 rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-6 sm:grid-cols-2">
      <input type="hidden" name="slug" value={params.slug} />
      <input type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label className="sm:col-span-2"><span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A4B6D0]">Nome *</span><input name="name" required minLength={2} maxLength={120} autoComplete="name" className={field} /></label>
      <label><span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A4B6D0]">E-mail</span><input name="email" type="email" maxLength={160} autoComplete="email" className={field} /></label>
      <label><span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A4B6D0]">WhatsApp</span><input name="phone" type="tel" maxLength={30} autoComplete="tel" className={field} /></label>
      <label><span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A4B6D0]">Empresa</span><input name="company" maxLength={160} autoComplete="organization" className={field} /></label>
      <label><span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A4B6D0]">Quantidade</span><input name="quantity" maxLength={60} placeholder="1 rolo, 1 caixa (12)…" className={field} /></label>
      <label className="sm:col-span-2"><span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A4B6D0]">Mensagem</span><textarea name="message" rows={3} maxLength={1000} className={field} /></label>
      <p className="text-xs text-white/40 sm:col-span-2">Informe e-mail ou WhatsApp. Usamos seus dados só para responder este pedido.</p>
      <button type="submit" className="rounded-full py-3.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white sm:col-span-2" style={{ background: company.accent ?? "#E11C24" }}>Enviar ↗</button>
    </form>
  );
  return <ProductLanding d={d} lead={searchParams.lead} form={form} />;
}
