import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { requireCompany, byCompany, isLegacy } from "@/lib/company";
import { LISTINGS, evaluate, resolveListing, type ListingBundle } from "@/lib/marketplace/listings";

export const metadata = { title: "Anúncios" };
export const dynamic = "force-dynamic";

export default async function AnunciosPage() {
  const supabase = createClient();
  const company = await requireCompany();
  const { data: jobs } = await supabase.from("mk_ad_jobs").select("id").eq("status", "done").match(isLegacy(company.id) ? {} : { kind: "anuncio", company_id: company.id }).order("created_at", { ascending: false }).limit(30);
  const fromJobs = (await Promise.all((jobs ?? []).map(async (j) => {
    const b = await resolveListing(`job-${j.id}`, supabase);
    return b ? { slug: `job-${j.id}`, b } : null;
  }))).filter(Boolean) as { slug: string; b: ListingBundle }[];
  // anúncios fixos do repositório são da Kairós
  const all = [...(company.slug === "kairos" ? LISTINGS.map((b) => ({ slug: b.listing.slug, b })) : []), ...fromJobs];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader overline="Marketplaces · prontos para publicar" title="Anúncios"
        subtitle="Anúncios validados automaticamente contra a política de cada marketplace — os do repositório e os gerados pelo agente.">
        <Link href="/catalogo" className="btn-primary">Gerar novo ↗</Link>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {all.map(({ slug, b }) => {
          const { summary } = evaluate(b);
          const main = b.listing.images.find((i) => i.role === "principal");
          return (
            <Link key={slug} href={`/anuncios/${slug}`} className="card group overflow-hidden transition hover:shadow-soft-lg">
              <div className="relative aspect-square bg-white">
                {main && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${b.baseUrl}/${main.file}`} alt={main.alt} className="h-full w-full object-contain p-6" />
                )}
                <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-white">TikTok Shop</span>
                {slug.startsWith("job-") && <span className="absolute right-3 top-3 rounded-full bg-kairos-red px-2.5 py-1 font-mono text-[10px] uppercase text-white">Agente</span>}
              </div>
              <div className="space-y-2 border-t border-line p-4">
                <h3 className="line-clamp-2 text-sm font-medium text-ink">{b.listing.title}</h3>
                <div className="flex flex-wrap gap-1.5 font-mono text-[10px] uppercase">
                  <span className={`rounded-full px-2 py-0.5 ${summary.conteudoPronto ? "bg-emerald-100 text-emerald-800" : "bg-kairos-red-soft text-kairos-red"}`}>
                    {summary.conteudoPronto ? "Política ok" : `${summary.erros} erros`}
                  </span>
                  <span className="rounded-full bg-[#EDEDE7] px-2 py-0.5 text-muted-fg">{summary.passed}/{summary.total}</span>
                  {summary.pendencias > 0 && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">{summary.pendencias} pendências</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
