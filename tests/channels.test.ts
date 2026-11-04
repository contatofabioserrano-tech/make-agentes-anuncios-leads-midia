// Testes dos validadores por canal (ML, Shopee, Amazon, Magalu, Alibaba). npm run test:anuncios
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateChannel, summarizeChannel, CHANNEL_RULES, type ChannelListing, type ChannelKey } from "../lib/marketplace/channels.ts";

const ROOT = join(import.meta.dirname, "..");
const data: Record<ChannelKey, ChannelListing> = JSON.parse(readFileSync(join(ROOT, "lib/marketplace/data/hyper-petg-preto.channels.json"), "utf8"));
const meta = JSON.parse(readFileSync(join(ROOT, "public/marketplace/hyper-petg-preto/assets.json"), "utf8"));
const erros = (l: ChannelListing) => validateChannel(l, meta).filter((c) => !c.ok && c.severity === "erro").map((c) => `${c.id}: ${c.detail}`);

for (const k of Object.keys(CHANNEL_RULES) as ChannelKey[]) {
  test(`${k}: anúncio real do Hyper PETG sem erro de regra`, () => {
    assert.deepEqual(erros(data[k]), []);
    assert.equal(summarizeChannel(validateChannel(data[k], meta)).conteudoPronto, true);
  });
}

test("ML: título acima de 60 caracteres é recusado", () => {
  assert.ok(erros({ ...data.mercado_livre, title: "x".repeat(61) + " Creality" }).some((e) => e.includes("titulo-max")));
});
test("Amazon: exige 5 bullets e principal sem texto", () => {
  const e = erros({ ...data.amazon, bullets: data.amazon.bullets!.slice(0, 3), images: [{ file: "d1_configuracoes_impressao.jpg", hasAddedText: true }] });
  assert.ok(e.some((x) => x.includes("bullets")));
  assert.ok(e.some((x) => x.includes("principal-texto")));
  const foto = erros({ ...data.amazon, images: [{ file: "02_uso_impressora.jpg", hasAddedText: false }] });
  assert.ok(foto.some((x) => x.includes("principal-branco")));
});
test("Magalu: galeria com texto é recusada", () => {
  const imgs = [...data.magalu.images, { file: "faq1_compatibilidade.jpg", hasAddedText: true }];
  assert.ok(erros({ ...data.magalu, images: imgs }).some((x) => x.includes("texto")));
});
test("Shopee: contato na descrição é recusado; máximo 9 imagens", () => {
  assert.ok(erros({ ...data.shopee, description: data.shopee.description + " chama no whats (11) 99999-0000" }).some((x) => x.includes("contato")));
  assert.ok(erros({ ...data.shopee, images: [...data.shopee.images, data.shopee.images[0]] }).some((x) => x.includes("img-qtd")));
});
test("Alibaba: título em português é recusado", () => {
  assert.ok(erros({ ...data.alibaba, title: "Filamento PETG Creality para impressão" }).some((x) => x.includes("idioma")));
});
test("todos: termo promocional é recusado", () => {
  assert.ok(erros({ ...data.magalu, title: data.magalu.title + " Frete Grátis" }).some((x) => x.includes("promo")));
});
