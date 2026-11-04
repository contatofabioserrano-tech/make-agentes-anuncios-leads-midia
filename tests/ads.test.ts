// Testes dos textos de campanha (Meta, Google, OpenAI Ads). npm run test:anuncios
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { validateAds, AD_LIMITS, type AdCopy } from "../lib/marketplace/ads.ts";

const ROOT = join(import.meta.dirname, "..");
const copy: AdCopy = JSON.parse(readFileSync(join(ROOT, "lib/marketplace/data/hyper-petg-preto.ads.json"), "utf8"));
const meta = JSON.parse(readFileSync(join(ROOT, "public/marketplace/hyper-petg-preto/ads/assets.json"), "utf8"));

test("textos reais dentro dos limites de cada plataforma", () => {
  const bad = validateAds(copy).filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`);
  assert.deepEqual(bad, []);
});
test("título do Google com 31 caracteres é recusado", () => {
  const c = structuredClone(copy);
  c.google.titulo[0] = "x".repeat(31);
  assert.ok(validateAds(c).some((x) => !x.ok && x.id === "google-titulo-0"));
});
test("criativos existem nos 4 formatos com a proporção certa", () => {
  const want: Record<string, number> = { "1x1": 1, "4x5": 0.8, "9x16": 9 / 16, "191x1": 1.91 };
  for (const [fmt, ratio] of Object.entries(want)) {
    for (const src of ["principal", "uso", "pecas"]) {
      const f = `${src}_${fmt}.jpg`;
      assert.ok(existsSync(join(ROOT, "public/marketplace/hyper-petg-preto/ads", f)), f);
      assert.ok(Math.abs(meta[f].width / meta[f].height - ratio) < 0.01, `${f} ${meta[f].width}x${meta[f].height}`);
    }
  }
  for (const p of Object.values(AD_LIMITS)) for (const fmt of p.formatos) assert.ok(fmt in want);
});
