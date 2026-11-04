import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Entrar — MakeOne",
};

export default async function LoginPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/painel");
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Logo />
          <div className="mt-10">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">
              Acesse o portal
            </h1>
            <p className="mt-2 text-sm text-muted-fg">
              Acesso restrito à equipe MakeOne e empresas convidadas.
            </p>
          </div>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Right: brand panel (dark) */}
      <div className="relative hidden overflow-hidden bg-surface-dark lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_80%_0%,rgba(225,28,36,0.30),transparent_55%),radial-gradient(120%_120%_at_0%_100%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-between p-14 text-white">
          <Logo dark />
          <div>
            <p className="text-3xl font-extrabold leading-tight tracking-tight">
              Do produto ao lead,{" "}
              <span className="gradient-text">no automático.</span>
            </p>
            <p className="mt-4 max-w-md text-sm text-white/60">
              Envie links, fotos ou PDFs do produto e os agentes montam o
              cadastro, as imagens, o vídeo comercial, os anúncios por canal e
              a landing com captura de leads, com você aprovando cada etapa.
            </p>
          </div>
          <div className="flex gap-3 text-xs text-white/40">
            <span>Cadastro</span>
            <span>·</span>
            <span>Imagens e vídeo</span>
            <span>·</span>
            <span>Anúncios</span>
            <span>·</span>
            <span>Leads</span>
          </div>
        </div>
      </div>
    </main>
  );
}
