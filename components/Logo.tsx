interface LogoProps {
  dark?: boolean;
  subtitle?: boolean;
  /** Só o símbolo (menu recolhido). */
  compact?: boolean;
  className?: string;
}

/** Marca Fortuna no padrão editorial Kairós: seta vermelha + wordmark geométrico. */
export function Logo({ dark = false, subtitle = true, compact = false, className = "" }: LogoProps) {
  const ink = dark ? "text-white" : "text-ink";
  const mark = (
    <svg viewBox="0 0 32 20" className="h-4 w-6 shrink-0" aria-hidden>
      <path d="M0 0 L32 10 L0 20 L8 10 Z" fill="#E11C24" />
    </svg>
  );
  if (compact) return <div className={`flex h-8 items-center justify-center ${className}`}>{mark}</div>;
  return (
    <div className={`flex flex-col leading-none ${className}`}>
      <span className={`flex items-center gap-1.5 font-display text-[22px] font-bold uppercase tracking-[0.02em] ${ink}`}>
        Fortuna{mark}
      </span>
      {subtitle && (
        <span className={`mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] ${dark ? "text-white/45" : "text-muted-fg"}`}>
          Creative · Máquina de anúncios
        </span>
      )}
    </div>
  );
}
