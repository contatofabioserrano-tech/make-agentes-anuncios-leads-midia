import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { campaignSlugs, getCampaign } from "@/lib/marketplace/listings";

export const metadata = { title: "Campanhas — Kairós" };

export default function CampanhasPage() {
  const list = campaignSlugs().map((s) => ({ slug: s, c: getCampaign(s)! }));
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader overline="Mídia paga" title="Campanhas" subtitle="Meta Ads, Google Ads e OpenAI Ads: textos dentro do limite de cada plataforma e criativos em 1:1, 4:5, 9:16 e 1,91:1." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(({ slug, c }) => (
          <Link key={slug} href={`/campanhas/${slug}`} className="card block overflow-hidden hover:shadow-soft-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${c.adsUrl}/principal_191x1.jpg`} alt="" className="aspect-[1.91/1] w-full object-cover" />
            <div className="p-4">
              <p className="font-semibold text-ink">{c.base.title}</p>
              <p className="mt-1 text-xs text-muted-fg">{c.checks.filter((x) => x.ok).length}/{c.checks.length} verificações ok</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
