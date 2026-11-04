import type { Campaign, StageKey } from "@/lib/types";

/** Campaign presets — each fixes the delivery aspect ratio. */
export const CAMPAIGNS: Record<
  Campaign,
  { label: string; short: string; aspect: string }
> = {
  meta: { label: "Meta Ads · Reels 9:16", short: "Meta", aspect: "9:16" },
  google: { label: "Google Ads · 16:9 integral", short: "Google", aspect: "16:9" },
  ambos: {
    label: "Meta + Google · 9:16 e 16:9",
    short: "Ambos",
    aspect: "9:16+16:9",
  },
};

export function campaignLabel(campaign: Campaign | null): string {
  return campaign ? CAMPAIGNS[campaign].short : "Nenhuma";
}

export interface SquadAgent {
  /** Pipeline stage this agent owns. */
  key: Exclude<StageKey, "render" | "done">;
  /** Stage label for UI chips. */
  label: string;
  /** Agent display name. */
  agent: string;
  /** Emoji avatar. */
  emoji: string;
  /** One-line role description. */
  role: string;
  /** Builds the agent's delivery message text for a given project brief. */
  deliveryTemplate: (brief: string) => string;
}

const safeBrief = (brief: string) => {
  const trimmed = (brief || "").trim();
  return trimmed.length > 0 ? trimmed : "o material enviado";
};

/**
 * The Fortuna Creative squad, in execution order.
 * Each agent owns one stage of the agentic approval pipeline.
 */
export const STAGES: SquadAgent[] = [
  {
    key: "roteiro",
    label: "Roteiro",
    agent: "Roteirista",
    emoji: "🎬",
    role: "Estrutura e copy",
    deliveryTemplate: (brief) =>
      `Estruturei o roteiro a partir de "${safeBrief(
        brief
      )}". Formato 9:16 vertical, com hook nos 2s iniciais para travar a atenção, desenvolvimento em 3 blocos de prova e um CTA direto no fechamento. Copy enxuta, ritmo de leitura rápido e tom alinhado ao padrão da marca. As falas já estão marcadas com timestamps para guiar a legenda e o corte.`,
  },
  {
    key: "imagem",
    label: "Imagem",
    agent: "Diretor de Imagem",
    emoji: "🎨",
    role: "Geração visual — Higgsfield",
    deliveryTemplate: (brief) =>
      `Gerei o pacote visual no Higgsfield (nano_banana_2), 9:16 em 2k, seguindo o roteiro de "${safeBrief(
        brief
      )}". Direção de fotografia consistente: luz motivada, paleta da marca e enquadramentos com câmera fora da altura-dos-olhos. Selecionei os keyframes mais fortes para virarem cenas e deixei tudo pronto para a etapa de movimento.`,
  },
  {
    key: "legenda",
    label: "Legenda",
    agent: "Legendador",
    emoji: "⬜",
    role: "Transcrição + captions",
    deliveryTemplate: (brief) =>
      `Transcrevi o áudio e montei as legendas para "${safeBrief(
        brief
      )}". Estilo da marca: legenda branca embaixo, alto contraste, quebras curtas e sincronizadas palavra a palavra para leitura sem som. Timing revisado contra o roteiro para nenhuma fala estourar a frame.`,
  },
  {
    key: "montagem",
    label: "Montagem",
    agent: "Montador",
    emoji: "✂️",
    role: "Corte, trilha e render",
    deliveryTemplate: (brief) =>
      `Montei o corte final de "${safeBrief(
        brief
      )}": cenas encadeadas com transições premium, trilha com ducking sob a locução, normalização de loudness e legenda queimada no padrão da marca. Export configurado para 1080x1920 (9:16). Posso enfileirar o render final.`,
  },
];

export const STAGE_BY_KEY: Record<string, SquadAgent> = Object.fromEntries(
  STAGES.map((s) => [s.key, s])
);

/** Full ordered list of stage keys including terminal stages. */
export const STAGE_ORDER: StageKey[] = [
  "roteiro",
  "imagem",
  "legenda",
  "montagem",
  "render",
  "done",
];

/** Returns the next stage after the given one, or null if already terminal. */
export function nextStage(current: StageKey): StageKey | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

/** Human label for a stage key (used outside the squad too). */
export function stageLabel(stage: StageKey): string {
  if (stage === "render") return "Render";
  if (stage === "done") return "Concluído";
  return STAGE_BY_KEY[stage]?.label ?? stage;
}

/** The squad agent that owns a given stage, if any. */
export function agentForStage(stage: StageKey): SquadAgent | null {
  return STAGE_BY_KEY[stage] ?? null;
}
