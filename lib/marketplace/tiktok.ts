/**
 * Validador de anúncios do TikTok Shop Brasil.
 *
 * Fonte: "Política de Listagem de Produtos do TikTok Shop" (seller-br, versão
 * de 28/10/2026) + "Listagem de produtos: o que você precisa saber" (23/09/2025).
 * Onde as duas divergem, usamos a leitura MAIS RESTRITIVA (ex.: descrição com
 * 500+ caracteres E 30+ palavras; nenhuma imagem da galeria com texto).
 *
 * Este arquivo não importa nada de propósito: roda no Next (server) e também
 * direto no Node (`node --test tests/`), sem build.
 */

export type Severity = "erro" | "aviso" | "pendencia";

export interface ListingImage {
  file: string;
  /** principal = 1ª imagem da galeria; galeria = demais; descricao = imagens do corpo da descrição */
  role: "principal" | "galeria" | "descricao";
  alt: string;
  /** Texto/selo/gráfico ADICIONADO por nós (o logo impresso no próprio produto não conta). */
  hasAddedText: boolean;
  aiGenerated: boolean;
  /** Ângulo/cena — usado para barrar ângulos repetidos. */
  angle: string;
}

export interface ListingVideo {
  file: string;
  role: "produto" | "feed";
}

/** Medições reais dos arquivos (geradas por scripts/anuncios/build_tiktok_assets.py). */
export interface AssetMeta {
  width: number;
  height: number;
  bytes: number;
  /** % de pixels brancos (>=250 nos 3 canais) na borda de 2% da imagem. */
  whiteBorderRatio?: number;
  /** Desvio médio entre canais RGB — ~0 indica imagem em preto e branco. */
  colorfulness?: number;
  durationSec?: number;
}

export interface TikTokListing {
  slug: string;
  sku: string;
  odooId: number;
  brand: string;
  brandAuthorizationConfirmed: boolean;
  category: string;
  title: string;
  variationStyle: string;
  variations: { value: string; sku: string; stock: number | null }[];
  description: string;
  bullets: string[];
  boxContents: string;
  origin: string;
  warranty: string;
  care: string;
  attributes: Record<string, string>;
  price: number | null;
  /** Custo FOB do Odoo (sem frete internacional/impostos) — só para a calculadora de margem. */
  costFobBrl?: number;
  costFobUsd?: number;
  /** Preços públicos de referência (concorrência), só informativo. */
  marketPrices?: {
    consultadoEm: string;
    nota: string;
    itens: { loja: string; produto: string; preco: number; status: string; url: string }[];
  };
  packageDimensionsCm: { length: number; width: number; height: number } | null;
  packageWeightKg: number | null;
  images: ListingImage[];
  videos: ListingVideo[];
}

export interface Check {
  id: string;
  label: string;
  severity: Severity;
  ok: boolean;
  detail: string;
}

export const LIMITS = {
  titleMin: 25,
  titleMax: 200,
  descMinChars: 500,
  descMinWords: 30,
  bulletsMin: 3,
  bulletsMax: 5,
  imagesMax: 9,
  imagesRecommended: 5,
  imageMinPx: 600,
  videosMax: 1,
  videoMaxBytes: 5 * 1024 * 1024,
  mainWhiteBorderMin: 0.97,
} as const;

/** Termos subjetivos/promocionais citados pela política (título e descrição). */
export const PROMO_TERMS = [
  "mais vendido",
  "item de tendência",
  "tendência",
  "exclusivo do tiktok",
  "frete grátis",
  "nova versão",
  "estoque baixo",
  "satisfação garantida",
  "promoção",
  "desconto",
  "% off",
  "oferta",
  "imperdível",
  "liquidação",
  "o melhor",
  "garantia de 100%",
];

/** Caracteres que a política manda evitar no título. */
const FORBIDDEN_TITLE_CHARS = /[~!*$?_{}#<>|;^¬¦]/;
const URL_RE = /(https?:\/\/|www\.|\.com\b|\.com\.br\b)/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_RE = /(\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4})/;
const SPELLED_NUMBERS = /\b(um|uma|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove|dez)\b/i;
/** Palavras que podem ficar minúsculas no título (preposições, conjunções, artigos, unidades). */
const LOWER_OK = new Set([
  "a", "o", "as", "os", "um", "uma", "e", "ou", "de", "da", "do", "das", "dos",
  "em", "na", "no", "para", "por", "com", "sem", "até", "a", "à",
  "mm", "cm", "m", "kg", "g", "ml", "l", "mm/s", "un", "pol.",
]);

function words(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

function hasPromo(s: string): string | null {
  const low = s.toLowerCase();
  return PROMO_TERMS.find((t) => low.includes(t)) ?? null;
}

export function validateTikTokListing(
  l: TikTokListing,
  meta: Record<string, AssetMeta>,
): Check[] {
  const c: Check[] = [];
  const add = (id: string, label: string, severity: Severity, ok: boolean, detail: string) =>
    c.push({ id, label, severity, ok, detail });

  // ---------------- Título ----------------
  const t = l.title.trim();
  add("titulo-tamanho", "Título entre 25 e 200 caracteres", "erro",
    t.length >= LIMITS.titleMin && t.length <= LIMITS.titleMax, `${t.length} caracteres`);

  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "").length;
  add("titulo-caixa-alta", "Título sem TUDO EM MAIÚSCULAS", "erro",
    letters.length > 0 && upper / letters.length < 0.6,
    `${Math.round((upper / Math.max(1, letters.length)) * 100)}% das letras em maiúscula`);

  const badCase = words(t).filter((w) => {
    const first = w.charAt(0);
    if (/[0-9]/.test(first)) return false;
    if (LOWER_OK.has(w.toLowerCase())) return false;
    return first !== first.toUpperCase();
  });
  add("titulo-capitalizacao", "Primeira letra de cada palavra maiúscula (exceto preposições/artigos/unidades)", "aviso",
    badCase.length === 0, badCase.length ? `Corrigir: ${badCase.join(", ")}` : "ok");

  add("titulo-caracteres", "Título sem caracteres especiais proibidos (~!*$?_{}#<>|;^)", "erro",
    !FORBIDDEN_TITLE_CHARS.test(t), FORBIDDEN_TITLE_CHARS.test(t) ? "Encontrado caractere proibido" : "ok");

  const promoT = hasPromo(t);
  add("titulo-promocional", "Título sem termos promocionais/subjetivos", "erro", !promoT, promoT ? `Contém "${promoT}"` : "ok");

  add("titulo-plataformas", "Título sem 'TikTok', outras plataformas ou links", "erro",
    !/tiktok|shopee|mercado livre|amazon|aliexpress/i.test(t) && !URL_RE.test(t), "ok se não citar plataformas");

  add("titulo-marca", "Marca no título", "erro", t.toLowerCase().includes(l.brand.toLowerCase()), l.brand);

  const colorInTitle = l.variations.find((v) => new RegExp(`\\b${v.value}\\b`, "i").test(t));
  add("titulo-sem-cor", "Cor/tamanho na variação, não no título principal", "erro",
    !colorInTitle, colorInTitle ? `Tirar "${colorInTitle.value}" do título` : "ok");

  add("titulo-numerais", "Números em algarismos ('2' e não 'dois')", "aviso",
    !SPELLED_NUMBERS.test(t), SPELLED_NUMBERS.test(t) ? "Número por extenso no título" : "ok");

  // ---------------- Descrição ----------------
  const d = l.description;
  const nWords = words(d).length;
  add("descricao-tamanho", "Descrição com 500+ caracteres e 30+ palavras", "erro",
    d.length >= LIMITS.descMinChars && nWords >= LIMITS.descMinWords, `${d.length} caracteres, ${nWords} palavras`);

  add("descricao-topicos", "3 a 5 tópicos, cada um começando com maiúscula", "aviso",
    l.bullets.length >= LIMITS.bulletsMin && l.bullets.length <= LIMITS.bulletsMax &&
      l.bullets.every((b) => /^[A-ZÀ-Þ]/.test(b.trim())),
    `${l.bullets.length} tópicos`);

  const contact = URL_RE.test(d) || EMAIL_RE.test(d) || PHONE_RE.test(d) || /qr ?code|whatsapp|instagram/i.test(d);
  add("descricao-sem-contato", "Sem links, e-mail, telefone, QR code ou redes", "erro", !contact,
    contact ? "Remover contato/redirecionamento" : "ok");

  const promoD = hasPromo(d);
  add("descricao-promocional", "Sem material promocional (x% off, frete grátis...)", "erro", !promoD,
    promoD ? `Contém "${promoD}"` : "ok");

  add("descricao-origem", "País de origem informado", "erro",
    !!l.origin && d.toLowerCase().includes(l.origin.toLowerCase()), l.origin || "faltando");
  add("descricao-garantia", "Garantia informada", "erro", !!l.warranty && /garantia/i.test(d), l.warranty || "faltando");
  add("descricao-cuidados", "Cuidados/armazenamento informados", "aviso", !!l.care && d.includes(l.care.slice(0, 20)), "ok");
  add("descricao-conteudo", "Conteúdo da embalagem informado", "erro", !!l.boxContents && d.includes(l.boxContents.slice(0, 20)), l.boxContents || "faltando");
  add("descricao-imitacao", "Sem alegação de réplica/imitação", "erro", !/r[ée]plica|imita[çc][ãa]o|falsifica/i.test(d), "ok");

  // ---------------- Imagens ----------------
  const gallery = l.images.filter((i) => i.role !== "descricao");
  const main = gallery.find((i) => i.role === "principal");
  add("imagens-quantidade", "Galeria com 1 a 9 imagens", "erro",
    gallery.length >= 1 && gallery.length <= LIMITS.imagesMax, `${gallery.length} imagens`);
  add("imagens-recomendado", "Pelo menos 5 imagens (boa prática)", "aviso",
    gallery.length >= LIMITS.imagesRecommended, `${gallery.length} imagens`);

  for (const img of gallery) {
    const m = meta[img.file];
    if (!m) {
      add(`img-${img.file}-arquivo`, `${img.file}: arquivo medido`, "erro", false, "sem medição — rode o build de assets");
      continue;
    }
    add(`img-${img.file}-quadrada`, `${img.file}: quadrada (1:1)`, "erro", m.width === m.height, `${m.width}×${m.height}`);
    add(`img-${img.file}-tamanho`, `${img.file}: mínimo 600×600`, "erro",
      Math.min(m.width, m.height) >= LIMITS.imageMinPx, `${m.width}×${m.height}`);
    add(`img-${img.file}-texto`, `${img.file}: sem texto/selo/borda adicionados`, "erro", !img.hasAddedText,
      img.hasAddedText ? "Mover para a descrição" : "ok");
    if (m.colorfulness !== undefined)
      add(`img-${img.file}-cor`, `${img.file}: colorida (não P&B)`, "erro", m.colorfulness > 2, `índice ${m.colorfulness.toFixed(1)}`);
  }

  const desc = l.images.filter((i) => i.role === "descricao");
  for (const img of desc) {
    const m = meta[img.file];
    add(`desc-${img.file}`, `${img.file} (descrição): quadrada e >= 600 px`, "aviso",
      !!m && m.width === m.height && m.width >= LIMITS.imageMinPx, m ? `${m.width}×${m.height}` : "sem medição");
  }

  if (main) {
    const m = meta[main.file];
    add("principal-fundo-branco", "Imagem principal com fundo branco puro", "erro",
      !!m && (m.whiteBorderRatio ?? 0) >= LIMITS.mainWhiteBorderMin,
      m ? `${Math.round((m.whiteBorderRatio ?? 0) * 100)}% da borda branca` : "sem medição");
    add("principal-real", "Imagem principal é foto real (não IA/render)", "erro", !main.aiGenerated,
      main.aiGenerated ? "Trocar por foto real" : "foto real");
  } else {
    add("principal-existe", "Imagem principal definida", "erro", false, "faltando");
  }

  const angles = gallery.map((i) => i.angle);
  const dup = angles.filter((a, i) => angles.indexOf(a) !== i);
  add("imagens-angulos", "Sem imagens repetindo o mesmo ângulo", "erro", dup.length === 0,
    dup.length ? `Repetido: ${dup.join(", ")}` : "ok");

  const ai = gallery.filter((i) => i.aiGenerated);
  add("imagens-ia", "Imagens de IA fiéis ao produto real (conferência humana)", "aviso", ai.length === 0,
    ai.length ? `${ai.length} imagens de IA: conferir se rótulo, cor e carretel batem com o produto entregue` : "nenhuma");

  // ---------------- Vídeo ----------------
  const pv = l.videos.filter((v) => v.role === "produto");
  add("video-quantidade", "No máximo 1 vídeo no anúncio", "erro", pv.length <= LIMITS.videosMax, `${pv.length} vídeo(s)`);
  for (const v of pv) {
    const m = meta[v.file];
    add(`video-${v.file}-tamanho`, `${v.file}: até 5 MB`, "erro", !!m && m.bytes <= LIMITS.videoMaxBytes,
      m ? `${(m.bytes / 1024 / 1024).toFixed(2)} MB` : "sem medição");
  }

  // ---------------- Marca, variações, logística, preço ----------------
  add("marca-autorizacao", "Autorização da marca (LOA) cadastrada no Seller Center", "pendencia",
    l.brandAuthorizationConfirmed, l.brandAuthorizationConfirmed ? "confirmada" : `Confirmar se "${l.brand}" exige autorização`);
  add("variacoes", "Variações únicas (sem duplicadas)", "erro",
    new Set(l.variations.map((v) => v.value.toLowerCase())).size === l.variations.length && l.variations.length > 0,
    l.variations.map((v) => v.value).join(", "));
  add("categoria", "Categoria definida", "erro", !!l.category, l.category);
  add("preco", "Preço de venda definido", "pendencia", l.price !== null && l.price > 0,
    l.price ? `R$ ${l.price.toFixed(2)}` : "definir preço");
  add("estoque", "Estoque informado", "pendencia", l.variations.every((v) => v.stock !== null && v.stock > 0),
    l.variations.map((v) => `${v.value}: ${v.stock ?? "?"}`).join(", "));
  add("embalagem", "Peso e dimensões da embalagem unitária", "pendencia",
    !!l.packageDimensionsCm && !!l.packageWeightKg, l.packageWeightKg ? `${l.packageWeightKg} kg` : "medir a caixa de 1 rolo");

  return c;
}

/** Monta a descrição final no formato pedido pela política (intro + 3–5 tópicos + conteúdo, cuidados, origem, garantia). */
export function composeDescription(l: {
  intro: string; bullets: string[]; boxContents: string; care: string; origin: string; warranty: string;
}): string {
  return [
    l.intro,
    "",
    ...l.bullets.map((b) => `• ${b}`),
    "",
    `Conteúdo da embalagem: ${l.boxContents}`,
    `Cuidados: ${l.care}`,
    `País de origem: ${l.origin}.`,
    `Garantia: ${l.warranty}`,
  ].join("\n");
}

export function summarize(checks: Check[]) {
  const failed = checks.filter((x) => !x.ok);
  return {
    total: checks.length,
    passed: checks.length - failed.length,
    erros: failed.filter((x) => x.severity === "erro").length,
    avisos: failed.filter((x) => x.severity === "aviso").length,
    pendencias: failed.filter((x) => x.severity === "pendencia").length,
    /** Conteúdo pronto = nenhuma regra de política quebrada. Pendências são do vendedor (preço, estoque, LOA). */
    conteudoPronto: failed.every((x) => x.severity !== "erro"),
  };
}
