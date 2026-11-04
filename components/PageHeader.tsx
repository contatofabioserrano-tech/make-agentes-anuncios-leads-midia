/** Cabeçalho de página no padrão do portal: rótulo mono, título grande com ponto vermelho. */
export function PageHeader({
  title,
  subtitle,
  overline,
  children,
}: {
  title: string;
  subtitle?: string;
  overline?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {overline && <p className="eyebrow mb-3">{overline}</p>}
        <h1 className="display dot text-[34px] leading-[1.02] sm:text-[44px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted-fg">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
