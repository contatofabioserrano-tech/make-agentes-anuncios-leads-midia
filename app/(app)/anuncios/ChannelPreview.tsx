"use client";

import { useState } from "react";
import type { ChannelKey, ChannelListing } from "@/lib/marketplace/channels";

/** Cores de referência de cada vitrine (só para a prévia interna; sem logotipos). */
const SKIN: Record<ChannelKey, { bar: string; barText: string; buy: string; buyText: string; price: string; cta: string; cta2?: string; font?: string }> = {
  mercado_livre: { bar: "#FFE600", barText: "#333", buy: "#3483FA", buyText: "#fff", price: "#333", cta: "Comprar agora", cta2: "Adicionar ao carrinho" },
  shopee: { bar: "#EE4D2D", barText: "#fff", buy: "#EE4D2D", buyText: "#fff", price: "#EE4D2D", cta: "Comprar agora", cta2: "Adicionar ao carrinho" },
  amazon: { bar: "#131921", barText: "#fff", buy: "#FFA41C", buyText: "#111", price: "#B12704", cta: "Comprar agora", cta2: "Adicionar ao carrinho" },
  magalu: { bar: "#0086FF", barText: "#fff", buy: "#00A650", buyText: "#fff", price: "#0086FF", cta: "Comprar", cta2: "Adicionar à sacola" },
  alibaba: { bar: "#FF6A00", barText: "#fff", buy: "#FF6A00", buyText: "#fff", price: "#FF6A00", cta: "Contact supplier", cta2: "Start order" },
};

/** Prévia no formato da página de produto do canal, com as imagens que o kit já gerou. */
export function ChannelPreview({ canal, nome, l, baseUrl }: { canal: ChannelKey; nome: string; l: ChannelListing; baseUrl: string }) {
  const s = SKIN[canal];
  const [i, setI] = useState(0);
  const imgs = l.images;
  const cur = imgs[Math.min(i, imgs.length - 1)];
  const en = canal === "alibaba";
  const price = l.price ? l.price.toLocaleString(en ? "en-US" : "pt-BR", { style: "currency", currency: en ? "USD" : "BRL" }) : en ? "Price on request" : "R$ —,—";
  const highlights = (l.bullets ?? Object.entries(l.attributes).slice(0, 5).map(([k, v]) => `${k}: ${v}`)).slice(0, 5);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
      <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: s.bar, color: s.barText }}>
        <span className="text-sm font-bold">{nome}</span>
        <span className="flex-1 truncate rounded-md bg-white/90 px-3 py-1.5 text-xs text-[#999]">{en ? "Search products" : "Buscar produtos, marcas e muito mais…"}</span>
        <span className="font-mono text-[10px] uppercase opacity-80">prévia</span>
      </div>
      <div className="grid gap-5 p-4 md:grid-cols-[64px_1fr_1fr]">
        <div className="order-2 flex gap-2 overflow-x-auto md:order-1 md:flex-col">
          {imgs.map((im, k) => (
            <button key={im.file + k} type="button" onMouseEnter={() => setI(k)} onClick={() => setI(k)} aria-label={`Imagem ${k + 1}`}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-white ${k === i ? "" : "border-[#eee]"}`} style={k === i ? { borderColor: s.buy } : undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${baseUrl}/${im.file}`} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <div className="order-1 md:order-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cur && <img src={`${baseUrl}/${cur.file}`} alt={l.title} className="aspect-square w-full rounded-lg object-contain" />}
        </div>
        <div className="order-3 space-y-3 text-[#333]">
          <p className="text-xs text-[#999]">{en ? "New · Ready to ship" : "Novo"} · {l.brand}</p>
          <h3 className="text-[18px] font-semibold leading-snug">{l.title}</h3>
          <p className="text-[28px] font-light" style={{ color: s.price }}>{price}</p>
          {canal === "alibaba" && <p className="text-xs text-[#666]">MOQ: {l.moq ?? "a confirmar"} · {l.packaging}</p>}
          <ul className="space-y-1 text-[13px]">
            {highlights.map((h) => <li key={h} className="flex gap-2"><span style={{ color: s.buy }}>•</span><span>{h}</span></li>)}
          </ul>
          <div className="space-y-2 pt-2">
            <button type="button" disabled className="w-full rounded-md py-2.5 text-sm font-semibold" style={{ background: s.buy, color: s.buyText }}>{s.cta}</button>
            {s.cta2 && <button type="button" disabled className="w-full rounded-md py-2.5 text-sm font-semibold" style={{ background: `${s.buy}22`, color: s.buy === "#FFA41C" ? "#111" : s.buy }}>{s.cta2}</button>}
          </div>
        </div>
      </div>
      <details className="border-t border-[#eee] px-4 py-3 text-[13px] text-[#333]">
        <summary className="cursor-pointer font-semibold">{en ? "Product description" : "Descrição"}</summary>
        <p className="mt-2 whitespace-pre-line leading-relaxed">{l.description}</p>
      </details>
    </div>
  );
}
