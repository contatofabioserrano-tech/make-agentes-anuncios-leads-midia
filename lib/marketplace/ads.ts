/**
 * Campanhas pagas: Meta Ads (Facebook/Instagram), Google Ads (Pesquisa + Performance Max) e OpenAI Ads (ChatGPT).
 * Limites de caracteres por campo, levantados em 03/11/2026. Sem imports de valor: roda no Node (`node --test`).
 */
export type AdPlatform = "meta" | "google" | "openai";

export interface FieldLimit { key: string; label: string; max: number; min?: number; count: [number, number]; hard: boolean }

export const AD_LIMITS: Record<AdPlatform, { nome: string; campos: FieldLimit[]; formatos: string[]; fontes: string[] }> = {
  meta: {
    nome: "Meta Ads (Facebook e Instagram)",
    campos: [
      { key: "primario", label: "Texto principal", max: 125, count: [1, 5], hard: false },
      { key: "titulo", label: "Título", max: 40, count: [1, 5], hard: false },
      { key: "descricao", label: "Descrição", max: 30, count: [1, 5], hard: false },
    ],
    formatos: ["1x1", "4x5", "9x16", "191x1"],
    fontes: ["Meta Ads Guide: texto principal 125 caracteres (o resto fica em “ver mais”), título 40, descrição 30; até 5 variações de cada (texto dinâmico)",
      "Feed 1:1 e 4:5, Stories/Reels 9:16, links 1,91:1"],
  },
  google: {
    nome: "Google Ads (Pesquisa e Performance Max)",
    campos: [
      { key: "titulo", label: "Título (RSA/PMax)", max: 30, count: [3, 15], hard: true },
      { key: "titulo_longo", label: "Título longo (PMax)", max: 90, count: [1, 5], hard: true },
      { key: "descricao", label: "Descrição", max: 90, count: [2, 4], hard: true },
      { key: "descricao_curta", label: "Descrição curta (PMax)", max: 60, count: [1, 1], hard: true },
      { key: "caminho", label: "Caminho de exibição", max: 15, count: [0, 2], hard: true },
      { key: "empresa", label: "Nome da empresa", max: 25, count: [1, 1], hard: true },
    ],
    formatos: ["1x1", "191x1", "4x5", "9x16"],
    fontes: ["Google Ads Ajuda — anúncios responsivos de pesquisa: até 15 títulos de 30 e 4 descrições de 90; caminho 2 × 15",
      "Performance Max: título longo 90, descrição curta 60, nome da empresa 25; imagens 1,91:1, 1:1 e 4:5 (9:16 para vídeo/Shorts)"],
  },
  openai: {
    nome: "OpenAI Ads (ChatGPT)",
    campos: [
      { key: "titulo", label: "Título", max: 50, count: [1, 3], hard: true },
      { key: "descricao", label: "Descrição", max: 100, count: [1, 3], hard: true },
    ],
    formatos: ["1x1"],
    fontes: ["help.openai.com (Create ads for ChatGPT): anúncio de imagem única com título 50 e descrição 100, imagem quadrada 1:1; multi-imagem (beta desde 26/10/2026) com 4–6 imagens 1:1",
      "Recomendado: título de 16–24 e descrição de 32–48 caracteres (guias de terceiros)"],
  },
};

export type AdCopy = Record<AdPlatform, Record<string, string[]>>;

export interface AdCheck { id: string; label: string; ok: boolean; severity: "erro" | "aviso"; detail: string }

const PROMO_ABUSE = /(!{2,}|\?{2,}|[A-ZÁÉÍÓÚÃÕÇ]{6,}\s[A-ZÁÉÍÓÚÃÕÇ]{6,})/;

export function validateAds(copy: AdCopy): AdCheck[] {
  const out: AdCheck[] = [];
  for (const p of Object.keys(AD_LIMITS) as AdPlatform[]) {
    for (const f of AD_LIMITS[p].campos) {
      const list = copy[p]?.[f.key] ?? [];
      const [mn, mx] = f.count;
      out.push({ id: `${p}-${f.key}-qtd`, label: `${AD_LIMITS[p].nome}: ${f.label} — ${mn === mx ? mn : `${mn} a ${mx}`} variações`, severity: "erro",
        ok: list.length >= mn && list.length <= mx, detail: `${list.length}` });
      list.forEach((t, k) => {
        out.push({ id: `${p}-${f.key}-${k}`, label: `${f.label} ${k + 1} até ${f.max} caracteres`, severity: f.hard ? "erro" : "aviso",
          ok: t.length <= f.max && t.trim().length > 0, detail: `${t.length}/${f.max} · ${t}` });
        if (PROMO_ABUSE.test(t)) out.push({ id: `${p}-${f.key}-${k}-estilo`, label: `${f.label} ${k + 1}: sem pontuação repetida ou CAIXA ALTA`, severity: "erro", ok: false, detail: t });
      });
      const dup = list.find((t, k) => list.indexOf(t) !== k);
      if (dup) out.push({ id: `${p}-${f.key}-dup`, label: `${f.label}: sem variações repetidas`, severity: "erro", ok: false, detail: dup });
    }
  }
  return out;
}
