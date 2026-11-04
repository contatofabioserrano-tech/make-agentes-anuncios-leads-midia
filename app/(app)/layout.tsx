import { requireSession, isAdmin } from "@/lib/auth";
import { cookies } from "next/headers";
import { getActiveCompany } from "@/lib/company";
import { Sidebar, SIDEBAR_COOKIE } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { email, profile } = await requireSession();
  const { company, companies } = await getActiveCompany();
  const name = profile?.name?.trim() || (email ? email.split("@")[0] : "Equipe Kairós");

  return (
    <div className="min-h-screen bg-paper lg:flex">
      <Sidebar name={name} email={email ?? ""} isAdmin={isAdmin(profile)} initialCollapsed={cookies().get(SIDEBAR_COOKIE)?.value === "1"}
        companies={companies.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))} activeCompany={company ? { id: company.id, name: company.name, kind: company.kind, logo: company.logo_url } : null} />
      <main className="min-w-0 flex-1 pt-14 lg:pt-0">
        {company ? children : (
          <div className="mx-auto max-w-xl px-6 py-20 text-center">
            <h1 className="display text-[28px]">Você ainda não está em nenhuma empresa</h1>
            <p className="mt-2 text-sm text-muted-fg">Peça ao responsável da sua empresa (ou à equipe Fortuna) para te convidar pelo seu e-mail.</p>
          </div>
        )}
      </main>
    </div>
  );
}
