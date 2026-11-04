import type { Campaign, VideoType } from "@/lib/types";

/** Wizard metadata for each video type produced by the Gerador. */
export const VIDEO_TYPES: Record<
  VideoType,
  {
    label: string;
    duration: string;
    emoji: string;
    tagline: string;
    features: string[];
    /** Optional highlight badge shown on the card (e.g. "4K"). */
    badge?: string;
  }
> = {
  propaganda: {
    label: "Propaganda Cinematográfica",
    duration: "35 segundos",
    emoji: "🎬",
    tagline: "Cinema gerado por IA, do roteiro ao endcard",
    features: [
      "Cenas de cinema geradas com Seedance",
      "Locução profissional + trilha",
      "Endcard com o logo da marca",
    ],
    badge: "4K",
  },
  reel: {
    label: "Reel",
    duration: "20–35 segundos",
    emoji: "⚡",
    tagline: "Corte rápido 9:16 que prende no feed",
    features: ["Ritmo acelerado para Meta", "Hook nos 2s iniciais", "Legenda queimada"],
  },
  carrossel: {
    label: "Carrossel",
    duration: "10 artes 4:5",
    emoji: "🖼️",
    tagline: "10 artes prontas para postar no Instagram",
    features: ["Capa de impacto", "8 artes de conteúdo", "Arte final com CTA"],
  },
  google_ads: {
    label: "Google Ads 16:9",
    duration: "Vídeo integral",
    emoji: "📺",
    tagline: "Horizontal completo para YouTube e Display",
    features: ["Formato 16:9 integral", "Feito para campanhas Google", "Locução + trilha"],
  },
  // Legados — mantidos apenas para projetos antigos (fora dos cards do wizard).
  comercial30: {
    label: "Comercial 30s",
    duration: "30 segundos",
    emoji: "🎬",
    tagline: "Cinema + locução + motion",
    features: ["Direção cinematográfica", "Locução profissional", "Motion graphics"],
  },
  integra: {
    label: "Vídeo Íntegra 60s",
    duration: "60 segundos",
    emoji: "🎙️",
    tagline: "Narração completa",
    features: ["Narração do início ao fim", "Aproveita vídeo base", "Formato integral"],
  },
};

export const VIDEO_TYPE_ORDER: VideoType[] = [
  "propaganda",
  "reel",
  "carrossel",
  "google_ads",
];

/**
 * Presets com aspect fixo — sobrepõem o aspect da campanha.
 * Carrossel também esconde o toggle de campanha (não se aplica).
 */
export const VIDEO_TYPE_ASPECT: Partial<Record<VideoType, string>> = {
  carrossel: "4:5",
  google_ads: "16:9",
};

/** Campaign toggle options for the wizard (each fixes the delivery aspect). */
export const CAMPAIGN_TOGGLE: { value: Campaign; label: string; aspect: string }[] = [
  { value: "meta", label: "Meta Ads", aspect: "9:16" },
  { value: "google", label: "Google Ads", aspect: "16:9" },
  { value: "ambos", label: "Ambos", aspect: "9:16+16:9" },
];

/** Tone options for the wizard briefing. */
export const TONE_OPTIONS: { value: string; label: string }[] = [
  { value: "comercial", label: "Comercial" },
  { value: "emocional", label: "Emocional" },
  { value: "urgente", label: "Urgente" },
];

export function toneLabel(tone: string | undefined): string {
  return TONE_OPTIONS.find((t) => t.value === tone)?.label ?? "Comercial";
}
