/** Card de indicador no padrão do portal: rótulo pequeno, número grande, nota abaixo. */
export function StatCard({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: number | string;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div className="card flex min-h-[132px] flex-col justify-between p-5">
      <p className="text-xs text-muted-fg">{label}</p>
      <p className={`display mt-3 text-[40px] leading-none tabular-nums ${accent ? "text-accent" : ""}`}>{value}</p>
      {note && <p className="mt-2 text-[11px] text-muted-fg">{note}</p>}
    </div>
  );
}
