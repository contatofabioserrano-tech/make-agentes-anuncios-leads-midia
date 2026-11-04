import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-dark text-2xl text-white">
        🔍
      </div>
      <h1 className="mt-5 text-xl font-bold text-ink">Projeto não encontrado</h1>
      <p className="mt-2 text-sm text-muted-fg">
        Ele pode ter sido removido ou você não tem acesso a ele.
      </p>
      <Link href="/projetos" className="btn-primary mt-6">
        Voltar para projetos
      </Link>
    </div>
  );
}
