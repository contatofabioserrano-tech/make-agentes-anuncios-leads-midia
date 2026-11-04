// Testes do anúncio TikTok Shop. Rodar com:  npm run test:anuncios
// (Node 22+ executa TypeScript direto, sem build.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  validateTikTokListing,
  summarize,
  composeDescription,
  type TikTokListing,
  type AssetMeta,
} from "../lib/marketplace/tiktok.ts";

const ROOT = join(import.meta.dirname, "..");
const SLUG = "hyper-petg-preto";
const raw = JSON.parse(readFileSync(join(ROOT, "lib/marketplace/data", `${SLUG}.json`), "utf8"));
const meta: Record<string, AssetMeta> = JSON.parse(
  readFileSync(join(ROOT, "public/marketplace", SLUG, "assets.json"), "utf8"),
);
const listing: TikTokListing = { ...raw.listing, description: composeDescription(raw.listing) };

const failing = (l: TikTokListing, m = meta) =>
  validateTikTokListing(l, m).filter((c) => !c.ok && c.severity === "erro").map((c) => c.id);

test("anúncio real: nenhuma regra da política quebrada", () => {
  const errors = validateTikTokListing(listing, meta).filter((c) => !c.ok && c.severity === "erro");
  assert.deepEqual(errors.map((e) => `${e.id}: ${e.detail}`), []);
  assert.equal(summarize(validateTikTokListing(listing, meta)).conteudoPronto, true);
});

test("anúncio real: todo arquivo citado existe e foi medido", () => {
  const files = [...listing.images.map((i) => i.file), ...listing.videos.map((v) => v.file), raw.feed.videoFile];
  for (const f of files) {
    assert.ok(existsSync(join(ROOT, "public/marketplace", SLUG, "tiktok", f)), `arquivo faltando: ${f}`);
    assert.ok(meta[f], `sem medição: ${f}`);
  }
});

test("anúncio real: imagens de dúvidas (FAQ) na descrição, nunca na galeria", () => {
  const faq = listing.images.filter((i) => i.file.startsWith("faq"));
  assert.ok(faq.length >= 4, "faltam imagens de dúvidas");
  assert.ok(faq.every((i) => i.role === "descricao" && i.hasAddedText));
  const desc = validateTikTokListing(listing, meta).filter((c) => c.id.startsWith("desc-"));
  assert.ok(desc.length >= 4 && desc.every((c) => c.ok), desc.filter((c) => !c.ok).map((c) => c.id).join(","));
});

test("anúncio real: pacote de feed completo (gancho, CTA, hashtags, palavras-chave)", () => {
  const f = raw.feed;
  assert.ok(f.hooks.length >= 3);
  assert.ok(f.ctas.length >= 3);
  assert.ok(f.hashtags.length >= 5 && f.hashtags.every((h: string) => h.startsWith("#")));
  assert.ok(f.searchKeywords.length >= 8);
  assert.ok(f.caption.length > 0 && f.caption.length <= 2200);
});

test("reprova título em CAIXA ALTA", () => {
  assert.ok(failing({ ...listing, title: listing.title.toUpperCase() }).includes("titulo-caixa-alta"));
});

test("reprova cor no título principal", () => {
  assert.ok(failing({ ...listing, title: `${listing.title} Preto` }).includes("titulo-sem-cor"));
});

test("reprova termo promocional no título", () => {
  assert.ok(failing({ ...listing, title: `${listing.title} Frete Grátis` }).includes("titulo-promocional"));
});

test("reprova título curto demais", () => {
  assert.ok(failing({ ...listing, title: "Filamento Creality" }).includes("titulo-tamanho"));
});

test("reprova link/contato na descrição", () => {
  assert.ok(failing({ ...listing, description: `${listing.description} Fale no WhatsApp www.loja.com.br` })
    .includes("descricao-sem-contato"));
});

test("reprova descrição curta", () => {
  assert.ok(failing({ ...listing, description: "Filamento PETG. Garantia. China." }).includes("descricao-tamanho"));
});

test("reprova imagem da galeria com texto adicionado", () => {
  const images = listing.images.map((i, k) => (k === 1 ? { ...i, hasAddedText: true } : i));
  assert.ok(failing({ ...listing, images }).some((id) => id.endsWith("-texto")));
});

test("reprova imagem não quadrada e menor que 600 px", () => {
  const f = listing.images[1].file;
  const ids = failing(listing, { ...meta, [f]: { ...meta[f], width: 500, height: 400 } });
  assert.ok(ids.includes(`img-${f}-quadrada`) && ids.includes(`img-${f}-tamanho`));
});

test("reprova imagem principal sem fundo branco ou gerada por IA", () => {
  const main = listing.images[0];
  assert.ok(failing(listing, { ...meta, [main.file]: { ...meta[main.file], whiteBorderRatio: 0.4 } })
    .includes("principal-fundo-branco"));
  const images = listing.images.map((i, k) => (k === 0 ? { ...i, aiGenerated: true } : i));
  assert.ok(failing({ ...listing, images }).includes("principal-real"));
});

test("reprova ângulo repetido e mais de 9 imagens", () => {
  const dupAngle = listing.images.map((i, k) => (k === 2 ? { ...i, angle: listing.images[1].angle } : i));
  assert.ok(failing({ ...listing, images: dupAngle }).includes("imagens-angulos"));
  const many = Array.from({ length: 10 }, (_, k) => ({ ...listing.images[1], angle: `a${k}` }));
  assert.ok(failing({ ...listing, images: many }).includes("imagens-quantidade"));
});

test("reprova vídeo acima de 5 MB", () => {
  const v = listing.videos[0].file;
  assert.ok(failing(listing, { ...meta, [v]: { ...(meta[v] ?? { width: 720, height: 1280 }), bytes: 6 * 1024 * 1024 } })
    .includes(`video-${v}-tamanho`));
});
