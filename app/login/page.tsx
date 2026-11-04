import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Entrar — Fortuna Creative",
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
              Acesse o studio
            </h1>
            <p className="mt-2 text-sm text-muted-fg">
              Acesso restrito à equipe Fortuna Creative.
            </p>
          </div>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Right: brand panel (dark) */}
      <div className="relative hidden overflow-hidden bg-surface-dark lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_80%_0%,rgba(124,58,237,0.35),transparent_55%),radial-gradient(120%_120%_at_0%_100%,rgba(61,90,254,0.30),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-between p-14 text-white">
          <Logo dark />
          <div>
            <p className="text-3xl font-extrabold leading-tight tracking-tight">
              Criatividade na{" "}
              <span className="gradient-text">velocidade da IA.</span>
            </p>
            <p className="mt-4 max-w-md text-sm text-white/60">
              Produção criativa com IA que conecta, engaja e converte. Suba um
              vídeo e deixe a squad cuidar de roteiro, imagem, legenda e
              montagem — com você aprovando cada etapa.
            </p>
          </div>
          <div className="flex gap-3 text-xs text-white/40">
            <span>🎬 Roteiro</span>
            <span>🎨 Imagem</span>
            <span>⬜ Legenda</span>
            <span>✂️ Montagem</span>
          </div>
        </div>
      </div>
    </main>
  );
}
