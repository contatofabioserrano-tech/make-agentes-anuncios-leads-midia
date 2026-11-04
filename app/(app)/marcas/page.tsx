import { requireSession, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import type { Brand } from "@/lib/types";
import { BrandsManager } from "./BrandsManager";

export const metadata = { title: "Marcas — Fortuna Creative" };
export const dynamic = "force-dynamic";

export default async function MarcasPage() {
  const { userId, profile } = await requireSession();
  const supabase = createClient();

  // RLS already scopes results: members see own rows, admins see all.
  let query = supabase
    .from("brands")
    .select("*")
    .order("created_at", { ascending: false });

  if (!isAdmin(profile)) {
    query = query.eq("owner", userId);
  }

  const { data: brands } = await query.returns<Brand[]>();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Marcas"
        subtitle="Kits de marca reutilizados pelo Gerador — logo, cores e contato em um só lugar."
      />
      <div className="mt-8">
        <BrandsManager brands={brands ?? []} />
      </div>
    </div>
  );
}
