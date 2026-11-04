"use client";

import { useState } from "react";
import type { LandingImage } from "@/lib/landing";

/** "Um novo ponto de vista": imagem grande + abas de ângulo, com contador 01 / 0N. */
export function Viewer({ images, accent }: { images: LandingImage[]; accent: string }) {
  const [i, setI] = useState(0);
  const cur = images[i];
  if (!cur) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1fr_320px]">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={cur.src} src={cur.src} alt={cur.alt} className="aspect-square w-full object-cover transition-opacity duration-500" />
        <span className="absolute bottom-4 left-4 rounded-full bg-black/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/80">{pad(i + 1)} / {pad(images.length)}</span>
      </div>
      <div>
        <div className="flex flex-wrap gap-2">
          {images.map((im, k) => (
            <button key={im.src} type="button" onClick={() => setI(k)} aria-pressed={k === i}
              className={`rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition ${k === i ? "border-white bg-white text-[#080B10]" : "border-white/15 text-white/70 hover:border-white/40"}`}>
              {im.label ?? `Vista ${k + 1}`}
            </button>
          ))}
        </div>
        <p className="mt-6 text-[15px] leading-relaxed text-white/70">{cur.alt}</p>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={() => setI((i - 1 + images.length) % images.length)} aria-label="Anterior" className="h-11 w-11 rounded-full border border-white/15 text-white hover:border-white/50">←</button>
          <button type="button" onClick={() => setI((i + 1) % images.length)} aria-label="Próxima" className="h-11 w-11 rounded-full text-white" style={{ background: accent }}>→</button>
        </div>
      </div>
    </div>
  );
}
