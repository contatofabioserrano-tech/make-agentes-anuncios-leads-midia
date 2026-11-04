"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setDraftPhoto } from "./actions";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

/** Fotos do produto no cadastro: a 1ª vira a principal (fundo branco) e referência das cenas de IA e do UGC. */
export function DraftPhotos({ draftId, companyId, fotos }: { draftId: string; companyId: string; fotos: string[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  async function send(files: FileList) {
    setBusy(true); setMsg(null);
    const supabase = createClient();
    const errs: string[] = [];
    for (const f of Array.from(files).slice(0, 12)) {
      if (!ACCEPT.includes(f.type)) { errs.push(`${f.name}: use JPG, PNG ou WEBP`); continue; }
      if (f.size > 20 * 1024 * 1024) { errs.push(`${f.name}: maior que 20 MB`); continue; }
      const path = `${companyId}/cad-${draftId.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}.${f.type.split("/")[1].replace("jpeg", "jpg")}`;
      const up = await supabase.storage.from("mk-fontes").upload(path, f, { contentType: f.type });
      if (up.error) { errs.push(`${f.name}: ${up.error.message}`); continue; }
      const r = await setDraftPhoto({ id: draftId, path });
      if (r?.error) errs.push(`${f.name}: ${r.error}`);
    }
    setBusy(false);
    setMsg(errs.length ? errs.join(" · ") : "Fotos enviadas.");
    router.refresh();
  }
  async function remove(path: string) {
    await setDraftPhoto({ id: draftId, path, remove: true });
    router.refresh();
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {fotos.map((f, k) => (
          <div key={f} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/fontes/arquivo?path=${encodeURIComponent(f)}`} alt="" className="h-24 w-24 rounded-lg border border-line object-cover" />
            {k === 0 && <span className="absolute left-1 top-1 rounded bg-ink px-1.5 py-0.5 font-mono text-[9px] uppercase text-white">principal</span>}
            <button type="button" onClick={() => remove(f)} aria-label="Remover foto" className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 text-xs text-accent">×</button>
          </div>
        ))}
        <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-line text-center text-[11px] text-muted-fg hover:border-ink">
          {busy ? "Enviando…" : "+ fotos"}
          <input type="file" multiple accept={ACCEPT.join(",")} className="sr-only" disabled={busy} onChange={(e) => e.target.files && send(e.target.files)} />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-fg">{msg ?? "A 1ª foto vira a imagem principal (fundo branco) e é a referência das cenas de IA e das fotos UGC. Use foto real, nítida, de pelo menos 1000 px."}</p>
    </div>
  );
}
