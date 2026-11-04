"use client";

import { useState } from "react";

export interface GalleryImage {
  src: string;
  alt: string;
  tag?: string;
}

/** Galeria no formato da página de produto do TikTok Shop (quadrada, com miniaturas). */
export function Gallery({ images }: { images: GalleryImage[] }) {
  const [i, setI] = useState(0);
  const cur = images[Math.min(i, images.length - 1)];
  if (!cur) return null;
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cur.src} alt={cur.alt} className="h-full w-full object-contain" />
        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
          {i + 1}/{images.length}
        </span>
        {cur.tag && (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-soft">
            {cur.tag}
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {images.map((im, k) => (
          <button
            key={im.src}
            type="button"
            onClick={() => setI(k)}
            aria-label={`Imagem ${k + 1}`}
            className={`aspect-square overflow-hidden rounded-lg border-2 bg-white ${k === i ? "border-[#FE2C55]" : "border-transparent"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.src} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
