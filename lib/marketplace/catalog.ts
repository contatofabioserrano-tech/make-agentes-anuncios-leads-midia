/** Linha do espelho do catálogo Odoo (public.mk_catalog_products). */
export interface CatalogProduct {
  odoo_id: number;
  sku: string | null;
  name_pt: string;
  name_en: string | null;
  name_zh: string | null;
  brand: string | null;
  category: string | null;
  status: string | null;
  price_usd: number | null;
  price_brl: number | null;
  price_cny: number | null;
  list_price: number | null;
  origin_country: string | null;
  ncm: string | null;
  hs_code: string | null;
  has_image: boolean;
  completeness: number;
  missing: string[];
  data: Record<string, unknown>;
  synced_at: string;
}

export interface AdJobStep {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
  detail?: string;
  at?: string;
}

export interface AdJob {
  id: string;
  company_id: string;
  /** anuncio = gera o anúncio; ingestao = lê links/fotos/PDFs e monta o cadastro */
  kind: "anuncio" | "ingestao";
  odoo_id: number | null;
  draft_id: string | null;
  source_ids: string[];
  marketplaces: string[];
  options: Record<string, unknown>;
  status: "queued" | "running" | "done" | "error" | "canceled";
  steps: AdJobStep[];
  result: Record<string, unknown>;
  credits_used: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const MARKETPLACES: { key: string; label: string }[] = [
  { key: "tiktok_shop", label: "TikTok Shop" },
  { key: "mercado_livre", label: "Mercado Livre" },
  { key: "shopee", label: "Shopee" },
  { key: "amazon", label: "Amazon" },
  { key: "alibaba", label: "Alibaba (B2B)" },
];

/** Etapas padrão do agente — o worker atualiza status/detalhe de cada uma. */
export const AGENT_STEPS: { key: string; label: string }[] = [
  { key: "dados", label: "Ler cadastro completo" },
  { key: "lacunas", label: "Checar lacunas do cadastro" },
  { key: "foto", label: "Foto principal (fundo branco 1:1)" },
  { key: "cenas", label: "Cenas de uso (IA, sem texto)" },
  { key: "textos", label: "Título, descrição, atributos, palavras-chave" },
  { key: "duvidas", label: "Imagens de dúvidas (FAQ)" },
  { key: "video", label: "Vídeo comercial (opcional)" },
  { key: "validacao", label: "Validar política de cada marketplace" },
  { key: "pacote", label: "Pacote final (ZIP + JSON/CSV)" },
];

export const pct = (n: number) => `${Math.round(n)}%`;
export const brl = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtDate = (s: string) =>
  new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/** Etapas do job de ingestão (materiais da empresa → cadastro → anúncios). */
export const AGENT_STEPS_INGEST: { key: string; label: string }[] = [
  { key: "ler", label: "Ler links, fotos e PDFs enviados" },
  { key: "extrair", label: "Extrair dados do produto (nome, marca, medidas, specs)" },
  { key: "cadastro", label: "Montar o cadastro padrão" },
  { key: "fotos", label: "Separar as fotos do produto" },
  { key: "anuncios", label: "Gerar os anúncios (se pedido)" },
];
