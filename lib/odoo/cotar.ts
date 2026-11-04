/**
 * Formulário de cadastro idêntico ao "cotar" do produto no Odoo Kairós (product.template),
 * mesmos nomes técnicos de campo. O portal grava em public.mk_product_drafts (o Odoo é só leitura).
 * Campos many2one apontam para as tabelas de opções do Odoo copiadas em public.mk_odoo_options.
 */
export type FieldType = "text" | "textarea" | "number" | "select" | "m2o";

export interface CotarField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** many2one: modelo do Odoo cujas opções estão em mk_odoo_options */
  model?: string;
  options?: string[];
  unit?: string;
  min?: number;
  help?: string;
}

export interface CotarSection { n: string; title: string; fields: CotarField[] }

export const COTAR_SECTIONS: CotarSection[] = [
  { n: "01", title: "Identificação", fields: [
    { key: "default_code", label: "Referência interna (SKU)", type: "text" },
    { key: "kairos_name_pt", label: "Nome comercial (PT)", type: "text", required: true },
    { key: "kairos_name_en", label: "Nome (EN)", type: "text" },
    { key: "kairos_name_zh", label: "Nome (中文)", type: "text" },
    { key: "kairos_brand", label: "Marca", type: "text", required: true },
    { key: "categ_id", label: "Categoria", type: "m2o", model: "product.category" },
    { key: "barcode", label: "Código de barras (EAN/GTIN)", type: "text", required: true, help: "8, 12, 13 ou 14 dígitos" },
    { key: "product_tag_ids", label: "Etiquetas", type: "text", help: "separe por vírgula" },
  ] },
  { n: "02", title: "Cotação e preço", fields: [
    { key: "kairos_price", label: "Preço do fornecedor", type: "number", min: 0 },
    { key: "kairos_price_currency_code", label: "Moeda do fornecedor", type: "select", options: ["USD", "CNY", "BRL"] },
    { key: "kairos_incoterm_id", label: "Incoterm", type: "m2o", model: "kairos.incoterm" },
    { key: "kairos_price_usd", label: "Custo FOB (USD)", type: "number", min: 0 },
    { key: "kairos_price_cny", label: "Custo (CNY)", type: "number", min: 0 },
    { key: "kairos_price_brl", label: "Custo (BRL)", type: "number", min: 0, required: true },
    { key: "kairos_reference_price", label: "Preço de referência de mercado", type: "number", min: 0 },
    { key: "list_price", label: "Preço de venda (BRL)", type: "number", min: 0, required: true },
    { key: "standard_price", label: "Custo contábil (BRL)", type: "number", min: 0 },
  ] },
  { n: "03", title: "Fiscal e origem", fields: [
    { key: "kairos_ncm_id", label: "NCM", type: "m2o", model: "kairos.ncm", required: true },
    { key: "kairos_ncm_rationale", label: "Justificativa do NCM", type: "textarea" },
    { key: "kairos_hs_id", label: "HS Code", type: "m2o", model: "kairos.hs" },
    { key: "kairos_hs_origin", label: "HS no país de origem", type: "text" },
    { key: "kairos_fiscal_description", label: "Descrição fiscal (DI/DUIMP)", type: "textarea" },
    { key: "kairos_origin_country_id", label: "País de origem", type: "m2o", model: "res.country", required: true },
    { key: "kairos_origin_description", label: "Descrição do fornecedor (origem)", type: "textarea" },
  ] },
  { n: "04", title: "Dados técnicos", fields: [
    { key: "kairos_technical_name", label: "Nome técnico", type: "text" },
    { key: "kairos_technical_description", label: "Descrição técnica (PT)", type: "textarea", required: true, help: "mínimo 120 caracteres" },
    { key: "kairos_technical_description_en", label: "Descrição técnica (EN)", type: "textarea" },
    { key: "description_sale", label: "Descrição de venda", type: "textarea" },
    { key: "kairos_voltage", label: "Voltagem", type: "m2o", model: "kairos.option" },
  ] },
  { n: "05", title: "Peso da unidade", fields: [
    { key: "kairos_fixed_weight", label: "Peso líquido", type: "number", unit: "kg", min: 0, required: true },
    { key: "kairos_gross_weight", label: "Peso bruto", type: "number", unit: "kg", min: 0 },
    { key: "volume", label: "Volume", type: "number", unit: "m³", min: 0 },
  ] },
  { n: "06", title: "Caixa master", fields: [
    { key: "kairos_package_qty", label: "Unidades por caixa", type: "number", min: 0 },
    { key: "kairos_qty_per_inner", label: "Unidades por inner", type: "number", min: 0 },
    { key: "kairos_package_length", label: "Comprimento", type: "number", unit: "cm", min: 0, required: true },
    { key: "kairos_package_width", label: "Largura", type: "number", unit: "cm", min: 0, required: true },
    { key: "kairos_package_height", label: "Altura", type: "number", unit: "cm", min: 0, required: true },
    { key: "kairos_package_gross_weight", label: "Peso bruto da caixa", type: "number", unit: "kg", min: 0, required: true },
    { key: "kairos_package_net_weight", label: "Peso líquido da caixa", type: "number", unit: "kg", min: 0 },
  ] },
  { n: "07", title: "Palete", fields: [
    { key: "kairos_pallet_qty", label: "Caixas por palete", type: "number", min: 0 },
    { key: "kairos_pallet_length", label: "Comprimento", type: "number", unit: "cm", min: 0 },
    { key: "kairos_pallet_width", label: "Largura", type: "number", unit: "cm", min: 0 },
    { key: "kairos_pallet_height", label: "Altura", type: "number", unit: "cm", min: 0 },
    { key: "kairos_pallet_gross_weight", label: "Peso bruto", type: "number", unit: "kg", min: 0 },
  ] },
  { n: "08", title: "Documentos e certificações", fields: [
    { key: "kairos_document_ids", label: "Documentos do produto", type: "m2o", model: "kairos.product.document" },
    { key: "kairos_missing_cert_names", label: "Certificações pendentes", type: "textarea", help: "ex.: INMETRO, ANATEL" },
  ] },
];

export const COTAR_FIELDS: CotarField[] = COTAR_SECTIONS.flatMap((s) => s.fields);
export const OPTION_MODELS = Array.from(new Set(COTAR_FIELDS.map((f) => f.model).filter(Boolean))) as string[];

export type DraftData = Record<string, string | number | null>;

/** Converte o valor bruto do Odoo (many2one = [id, nome]) para o valor do formulário. */
export function fromOdoo(raw: Record<string, unknown>): DraftData {
  const out: DraftData = {};
  for (const f of COTAR_FIELDS) {
    const v = raw[f.key];
    if (Array.isArray(v)) out[f.key] = v.length > 1 && typeof v[1] === "string" ? v[1] : v.length ? String(v[0]) : null;
    else if (typeof v === "number") out[f.key] = v || null;
    else if (typeof v === "string") out[f.key] = v.trim() || null;
    else out[f.key] = null;
  }
  return out;
}

/** Lê e valida o formulário. Números: vírgula decimal aceita; negativos e lixo viram erro. */
export function parseForm(fd: FormData): { data: DraftData; errors: string[] } {
  const data: DraftData = {};
  const errors: string[] = [];
  for (const f of COTAR_FIELDS) {
    const raw = String(fd.get(f.key) ?? "").trim().slice(0, f.type === "textarea" ? 5000 : 300);
    if (!raw) { data[f.key] = null; continue; }
    if (f.type === "number") {
      const n = Number(raw.replace(/\./g, "").replace(",", "."));
      const n2 = Number(raw);
      const val = Number.isFinite(n2) ? n2 : n;
      if (!Number.isFinite(val) || (f.min !== undefined && val < f.min)) { errors.push(`${f.label}: número inválido`); data[f.key] = null; continue; }
      data[f.key] = val;
    } else if (f.type === "select" && f.options && !f.options.includes(raw)) {
      errors.push(`${f.label}: opção inválida`); data[f.key] = null;
    } else data[f.key] = raw;
  }
  if (data.barcode && !/^(\d{8}|\d{12,14})$/.test(String(data.barcode))) errors.push("Código de barras: use 8, 12, 13 ou 14 dígitos");
  return { data, errors };
}

/** Mesmas regras de completude do catálogo (scripts/odoo/sync_catalog.py). */
export function completeness(d: DraftData): { pct: number; missing: string[] } {
  const req = COTAR_FIELDS.filter((f) => f.required);
  const missing = req.filter((f) => {
    const v = d[f.key];
    if (v === null || v === undefined || v === "") return true;
    if (f.key === "kairos_technical_description") return String(v).length < 120;
    if (f.key === "list_price") return Number(v) <= 1;
    if (f.type === "number") return Number(v) <= 0;
    return false;
  }).map((f) => f.label);
  return { pct: Math.round(((req.length - missing.length) / req.length) * 100), missing };
}
