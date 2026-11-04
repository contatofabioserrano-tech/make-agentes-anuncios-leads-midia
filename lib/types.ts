// DB row types — match the applied Supabase schema exactly.

export type Role = "member" | "admin";

export type ProjectStatus =
  | "novo"
  | "em_andamento"
  | "aguardando_aprovacao"
  | "renderizando"
  | "concluido"
  | "erro";

export type StageKey = "roteiro" | "imagem" | "legenda" | "montagem" | "render" | "done";

export type MessageRole = "user" | "agent" | "system";

export type MessageKind = "chat" | "approval_request" | "approval_response" | "delivery";

export type AssetKind = "image" | "video" | "audio";

export type RenderStatus = "queued" | "claimed" | "running" | "done" | "error";

export type Campaign = "meta" | "google" | "ambos";

/**
 * Video types produced by the Gerador wizard.
 * Presets ativos: propaganda, reel, carrossel, google_ads.
 * "comercial30" e "integra" são legados — mantidos no union apenas para
 * compatibilidade com projetos antigos (não aparecem mais nos cards).
 */
export type VideoType =
  | "propaganda"
  | "reel"
  | "carrossel"
  | "google_ads"
  | "comercial30"
  | "integra";

/** Structured briefing captured at project creation (projects.briefing). */
export interface Briefing {
  objetivo?: string;
  publico?: string;
  oferta?: string;
  cta?: string;
  tom?: string;
  observacoes?: string;
}

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  created_at: string;
}

export interface Project {
  id: string;
  owner: string;
  name: string;
  brief: string | null;
  status: ProjectStatus;
  stage: StageKey;
  video_path: string | null;
  thumb: string | null;
  format: string;
  folder: string;
  briefing: Briefing | null;
  campaign: Campaign | null;
  aspect: string;
  brand_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Brand kit row (table brands) — colors, logo and contact info reused by the Gerador. */
export interface Brand {
  id: string;
  owner: string;
  name: string;
  logo_path: string | null;
  color_primary: string | null;
  color_accent: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  tagline: string | null;
  /** Fotos reais da marca — paths no bucket 'assets' (jsonb array, default []). */
  photos: string[];
  created_at: string;
}

/** Singleton row (id=1) da tabela machine_status — heartbeat do worker de produção. */
export interface MachineStatus {
  id: number;
  worker_id: string | null;
  last_seen: string | null;
  credits: number | null;
  note: string | null;
}

export interface Edit {
  id: string;
  project_id: string;
  stage: string;
  version: number;
  payload: Record<string, unknown> | null;
  approved: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  project_id: string;
  role: MessageRole;
  agent: string | null;
  emoji: string | null;
  stage: string | null;
  kind: MessageKind;
  text: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface LibraryAsset {
  id: string;
  owner: string;
  project_id: string | null;
  kind: AssetKind;
  name: string;
  path: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface RenderJob {
  id: string;
  project_id: string;
  status: RenderStatus;
  spec: Record<string, unknown> | null;
  output_path: string | null;
  worker_id: string | null;
  error: string | null;
  progress: number | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
}
