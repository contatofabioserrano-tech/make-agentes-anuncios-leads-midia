import { requireSession, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MachineStatus } from "@/components/MachineStatus";
import type { Brand } from "@/lib/types";
import { GeneratorWizard } from "./GeneratorWizard";

export const metadata = { title: "Gerador de Vídeos — MakeOne" };
export const dynamic = "force-dynamic";

export default async function GeradorPage() {
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
    <div className="mx-auto max-w-4xl px-6 py-8 sm:px-10">
      <div className="mb-6">
        <MachineStatus />
      </div>

      <div className="mb-8">
        <p className="gradient-text text-xs font-bold uppercase tracking-widest">
          ✦ Produção automática
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
          Gerador de Vídeos
        </h1>
        <p className="mt-1 text-sm text-muted-fg">
          Escolha a marca, o tipo de vídeo e o briefing — a squad produz de
          ponta a ponta, sem aprovações manuais.
        </p>
      </div>

      <GeneratorWizard brands={brands ?? []} />
    </div>
  );
}
