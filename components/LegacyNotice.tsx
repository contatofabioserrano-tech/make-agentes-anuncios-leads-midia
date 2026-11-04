/** Aviso do modo de transição: a migração multiempresa ainda não foi aplicada no banco. */
export function LegacyNotice({ what }: { what: string }) {
  return (
    <div className="card mx-auto my-10 max-w-2xl p-8 text-center">
      <p className="eyebrow mb-2">Multiempresa · aguardando o banco</p>
      <h1 className="display text-[26px]">{what} liga quando o banco multiempresa subir</h1>
      <p className="mt-2 text-sm text-muted-fg">
        O código já está pronto. Falta aplicar <code className="font-mono">supabase/migrations/20261103b_multiempresa.sql</code> no Supabase.
        Até lá o portal funciona com uma única empresa (MakeOne).
      </p>
    </div>
  );
}
