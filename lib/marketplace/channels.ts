/**
 * Validadores dos marketplaces além do TikTok Shop: Mercado Livre, Shopee, Amazon BR, Magalu e Alibaba.
 *
 * As regras abaixo foram levantadas em 03/11/2026. Quando a central do vendedor não publica o número
 * (ou só fontes de integradores o citam), a regra vira "aviso" e o campo `fonte` diz de onde veio.
 * Regra de ouro: na dúvida, usamos o limite MAIS RESTRITIVO. Conferir no painel antes de publicar.
 *
 * Sem imports de valor de propósito: roda no Next e direto no Node (`node --test`).
 */
import type { AssetMeta, Check, Severity } from "./tiktok";

export type ChannelKey = "mercado_livre" | "shopee" | "amazon" | "magalu" | "alibaba";

export interface ChannelRules {
  key: ChannelKey;
  nome: string;
  idioma: "pt-BR" | "en";
  titleMin: number;
  titleMax: number;
  /** severidade quando o título passa do máximo (erro = a plataforma recusa; aviso = trunca/recomendação) */
  titleMaxSeverity: Severity;
  imagesMin: number;
  imagesMax: number;
  imageMinPx: number;
  mainWhite: boolean;
  mainNoText: boolean;
  galleryNoText: boolean;
  descMin: number;
  descMax: number | null;
  bullets: { min: number; max: number; maxChars: number } | null;
  fontes: string[];
}

export const CHANNEL_RULES: Record<ChannelKey, ChannelRules> = {
  mercado_livre: {
    key: "mercado_livre", nome: "Mercado Livre", idioma: "pt-BR",
    titleMin: 20, titleMax: 60, titleMaxSeverity: "erro",
    imagesMin: 1, imagesMax: 10, imageMinPx: 500, mainWhite: true, mainNoText: true, galleryNoText: false,
    descMin: 200, descMax: 50000, bullets: null,
    fontes: [
      "developers.mercadolivre.com.br/pt-br/trabalhar-com-imagens (mín. 500 px, recomendado 1200 px, fundo branco na 1ª)",
      "Central de Vendedores: título até 60 caracteres na maioria das categorias; sem contatos, links e símbolos",
    ],
  },
  shopee: {
    key: "shopee", nome: "Shopee", idioma: "pt-BR",
    titleMin: 20, titleMax: 120, titleMaxSeverity: "erro",
    imagesMin: 3, imagesMax: 9, imageMinPx: 500, mainWhite: false, mainNoText: false, galleryNoText: false,
    descMin: 100, descMax: 3000, bullets: null,
    fontes: [
      "Central do Vendedor Shopee: título até 120 caracteres; até 9 imagens 1:1 e 1 vídeo de até 60 s",
      "Descrição só texto, sem links externos nem contatos (limite de 3.000 caracteres — conferir no painel)",
    ],
  },
  amazon: {
    key: "amazon", nome: "Amazon BR", idioma: "pt-BR",
    titleMin: 30, titleMax: 200, titleMaxSeverity: "erro",
    imagesMin: 1, imagesMax: 9, imageMinPx: 1000, mainWhite: true, mainNoText: true, galleryNoText: false,
    descMin: 200, descMax: 2000, bullets: { min: 5, max: 5, maxChars: 500 },
    fontes: [
      "Seller Central (Requisitos de imagem do produto): principal com fundo branco puro RGB 255, produto ~85% do quadro, sem texto/logo, lado maior >= 1000 px para zoom",
      "Política de títulos: até 200 caracteres, sem termos promocionais e sem caracteres especiais repetidos",
      "Bullet points: 5 tópicos (até 500 caracteres cada) e descrição até 2.000 caracteres",
    ],
  },
  magalu: {
    key: "magalu", nome: "Magalu", idioma: "pt-BR",
    titleMin: 20, titleMax: 100, titleMaxSeverity: "aviso",
    imagesMin: 1, imagesMax: 10, imageMinPx: 800, mainWhite: true, mainNoText: true, galleryNoText: true,
    descMin: 200, descMax: null, bullets: null,
    fontes: [
      "Magalu Marketplace (via integradores Bling/Tray): fundo branco, sem marca d'água, logotipo ou texto sobreposto",
      "Título: produto + marca + modelo + características; 100 caracteres segundo integradores (Magalu não publica o número)",
    ],
  },
  alibaba: {
    key: "alibaba", nome: "Alibaba.com (B2B)", idioma: "en",
    titleMin: 20, titleMax: 128, titleMaxSeverity: "erro",
    imagesMin: 3, imagesMax: 6, imageMinPx: 640, mainWhite: true, mainNoText: false, galleryNoText: false,
    descMin: 200, descMax: null, bullets: null,
    fontes: [
      "Alibaba.com Product Posting Rules: product name up to 128 characters, in English",
      "Main image >= 640×640 px, white/clean background; 6 images maximum",
    ],
  },
};

export interface ChannelListing {
  canal: ChannelKey;
  title: string;
  description: string;
  bullets?: string[];
  /** arquivos de imagem (mesma pasta do kit), 1ª = principal */
  images: { file: string; hasAddedText: boolean }[];
  attributes: Record<string, string>;
  ean?: string | null;
  price: number | null;
  brand: string;
  /** B2B (Alibaba) */
  moq?: number | null;
  packaging?: string;
  extras?: Record<string, string>;
}

const PROMO = ["mais vendido", "frete grátis", "promoção", "desconto", "% off", "oferta", "imperdível", "liquidação",
  "o melhor", "best seller", "free shipping", "hot sale", "cheapest", "100% original"];
const URL_RE = /(https?:\/\/|www\.|\.com\b|\.com\.br\b)/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_RE = /(\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4})/;
const TITLE_SYMBOLS = /[~!*$?_{}#<>|;^@]/;

export function validateChannel(l: ChannelListing, meta: Record<string, AssetMeta>): Check[] {
  const r = CHANNEL_RULES[l.canal];
  const out: Check[] = [];
  const add = (id: string, label: string, severity: Severity, ok: boolean, detail: string) =>
    out.push({ id: `${l.canal}-${id}`, label, severity, ok, detail });
  const t = l.title.trim();
  const low = `${t}\n${l.description}`.toLowerCase();

  add("titulo-min", `Título com pelo menos ${r.titleMin} caracteres`, "erro", t.length >= r.titleMin, `${t.length} caracteres`);
  add("titulo-max", `Título até ${r.titleMax} caracteres`, r.titleMaxSeverity, t.length <= r.titleMax, `${t.length}/${r.titleMax}`);
  add("titulo-simbolos", "Título sem símbolos (@ # $ ! * …)", "erro", !TITLE_SYMBOLS.test(t), TITLE_SYMBOLS.exec(t)?.[0] ?? "ok");
  add("titulo-caixa-alta", "Título sem tudo em MAIÚSCULAS", "erro", t !== t.toUpperCase(), "ok");
  add("titulo-marca", "Título traz a marca", "aviso", t.toLowerCase().includes(l.brand.toLowerCase()), l.brand);
  const promo = PROMO.find((p) => low.includes(p));
  add("promo", "Sem termos promocionais no título/descrição", "erro", !promo, promo ? `“${promo}”` : "ok");
  add("contato", "Sem links, e-mail ou telefone", "erro", !URL_RE.test(low) && !EMAIL_RE.test(low) && !PHONE_RE.test(low), "ok");
  if (r.idioma === "en") {
    const nonAscii = (t.match(/[^\x00-\x7F–×±°]/g) ?? []).length;
    add("idioma", "Título e descrição em inglês", "erro", nonAscii === 0 && !/\b(para|com|filamento)\b/i.test(low), nonAscii ? `${nonAscii} caracteres fora do inglês` : "ok");
  }

  const d = l.description.trim();
  add("desc-min", `Descrição com pelo menos ${r.descMin} caracteres`, "erro", d.length >= r.descMin, `${d.length} caracteres`);
  if (r.descMax) add("desc-max", `Descrição até ${r.descMax} caracteres`, "erro", d.length <= r.descMax, `${d.length}/${r.descMax}`);
  if (r.bullets) {
    const b = l.bullets ?? [];
    add("bullets", `${r.bullets.min} tópicos (bullet points)`, "erro", b.length >= r.bullets.min && b.length <= r.bullets.max, `${b.length} tópicos`);
    const long = b.find((x) => x.length > r.bullets!.maxChars);
    add("bullets-tam", `Cada tópico até ${r.bullets.maxChars} caracteres`, "erro", !long, long ? `${long.length} caracteres` : "ok");
  }

  const imgs = l.images;
  add("img-qtd", `Entre ${r.imagesMin} e ${r.imagesMax} imagens`, "erro", imgs.length >= r.imagesMin && imgs.length <= r.imagesMax, `${imgs.length} imagens`);
  imgs.forEach((im, k) => {
    const m = meta[im.file];
    if (!m) { add(`img-${k}-medida`, `${im.file}: arquivo medido`, "erro", false, "sem medição"); return; }
    add(`img-${k}-px`, `${im.file}: mínimo ${r.imageMinPx} px`, "erro", Math.min(m.width, m.height) >= r.imageMinPx, `${m.width}×${m.height}`);
    add(`img-${k}-quadrada`, `${im.file}: quadrada (1:1)`, "aviso", m.width === m.height, `${m.width}×${m.height}`);
    if (k > 0 && r.galleryNoText) add(`img-${k}-texto`, `${im.file}: sem texto sobreposto`, "erro", !im.hasAddedText, im.hasAddedText ? "tem texto" : "ok");
  });
  const main = imgs[0];
  if (main) {
    const m = meta[main.file];
    if (r.mainWhite) add("principal-branco", "Imagem principal com fundo branco", "erro", (m?.whiteBorderRatio ?? 0) >= 0.97, m?.whiteBorderRatio !== undefined ? `${Math.round(m.whiteBorderRatio * 100)}% da borda branca` : "sem medição");
    if (r.mainNoText) add("principal-texto", "Imagem principal sem texto/selo", "erro", !main.hasAddedText, main.hasAddedText ? "tem texto" : "ok");
  }

  add("preco", "Preço de venda definido", "pendencia", !!l.price && l.price > 1, l.price ? `R$ ${l.price}` : "a definir");
  if (l.canal !== "alibaba") add("ean", "Código de barras (EAN/GTIN)", "pendencia", !!l.ean && /^\d{8,14}$/.test(l.ean), l.ean ?? "faltando no Odoo");
  if (l.canal === "alibaba") add("moq", "Pedido mínimo (MOQ) confirmado", "pendencia", !!l.moq && l.moq > 0, l.moq ? `${l.moq}` : "a confirmar");
  add("atributos", "Ficha técnica com 6+ atributos", "aviso", Object.keys(l.attributes).length >= 6, `${Object.keys(l.attributes).length} atributos`);
  return out;
}

export function summarizeChannel(checks: Check[]) {
  const failed = checks.filter((x) => !x.ok);
  return {
    total: checks.length,
    passed: checks.length - failed.length,
    erros: failed.filter((x) => x.severity === "erro").length,
    avisos: failed.filter((x) => x.severity === "aviso").length,
    pendencias: failed.filter((x) => x.severity === "pendencia").length,
    conteudoPronto: failed.every((x) => x.severity !== "erro"),
  };
}
