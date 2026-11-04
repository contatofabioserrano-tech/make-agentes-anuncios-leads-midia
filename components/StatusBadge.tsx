import type { Campaign, ProjectStatus, RenderStatus } from "@/lib/types";

const PROJECT_STYLES: Record<ProjectStatus, { label: string; cls: string; dot: string }> = {
  novo: { label: "Novo", cls: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-400" },
  em_andamento: {
    label: "Em andamento",
    cls: "border-blue-200 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  aguardando_aprovacao: {
    label: "Aguardando aprovação",
    cls: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  renderizando: {
    label: "Renderizando",
    cls: "border-violet-200 bg-violet-50 text-violet-700",
    dot: "bg-violet-500 animate-pulse",
  },
  concluido: {
    label: "Concluído",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  erro: { label: "Erro", cls: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" },
};

const RENDER_STYLES: Record<RenderStatus, { label: string; cls: string; dot: string }> = {
  queued: { label: "Na fila", cls: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-400" },
  claimed: {
    label: "Reservado",
    cls: "border-blue-200 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  running: {
    label: "Processando",
    cls: "border-violet-200 bg-violet-50 text-violet-700",
    dot: "bg-violet-500 animate-pulse",
  },
  done: {
    label: "Pronto",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  error: { label: "Erro", cls: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" },
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = PROJECT_STYLES[status] ?? PROJECT_STYLES.novo;
  return (
    <span className={`chip ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function RenderBadge({ status }: { status: RenderStatus }) {
  const s = RENDER_STYLES[status] ?? RENDER_STYLES.queued;
  return (
    <span className={`chip ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

const CAMPAIGN_STYLES: Record<Campaign, { label: string; cls: string }> = {
  meta: {
    label: "Meta · 9:16",
    cls: "border-blue-200 bg-blue-50 text-blue-700",
  },
  google: {
    label: "Google · 16:9",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  ambos: {
    label: "Meta + Google",
    cls: "border-violet-200 bg-violet-50 text-violet-700",
  },
};

export function CampaignBadge({ campaign }: { campaign: Campaign | null }) {
  if (!campaign) {
    return (
      <span className="chip border-black/10 bg-surface-muted text-muted-fg">
        Sem campanha
      </span>
    );
  }
  const s = CAMPAIGN_STYLES[campaign];
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}
