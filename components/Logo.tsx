interface LogoProps {
  dark?: boolean;
  subtitle?: boolean;
  /** Só o símbolo (menu recolhido). */
  compact?: boolean;
  className?: string;
}

/**
 * Marca MakeOne (provisória, só tipográfica). Quando o logo oficial chegar,
 * troque o símbolo abaixo pelo SVG/arquivo em public/brand/.
 */
export function Logo({ dark = false, subtitle = true, compact = false, className = "" }: LogoProps) {
  const ink = dark ? "text-white" : "text-ink";
  const mark = (
    <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent font-display text-[13px] font-bold text-white">
      1
    </span>
  );
  if (compact) return <div className={`flex h-8 items-center justify-center ${className}`}>{mark}</div>;
  return (
    <div className={`flex flex-col leading-none ${className}`}>
      <span className={`flex items-center gap-2 font-display text-[22px] font-bold tracking-[0.01em] ${ink}`}>
        {mark}MakeOne
      </span>
      {subtitle && (
        <span className={`mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] ${dark ? "text-white/45" : "text-muted-fg"}`}>
          Anúncios · Leads · Mídia
        </span>
      )}
    </div>
  );
}
