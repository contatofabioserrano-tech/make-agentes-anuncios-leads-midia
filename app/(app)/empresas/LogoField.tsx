"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Envia o logo para o bucket público "assets" (empresas/<id>/) e guarda a URL no campo logo_url do formulário. */
export function LogoField({ companyId, initial }: { companyId: string; initial: string | null }) {
  const [url, setUrl] = useState(initial ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  async function onFile(f: File) {
    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(f.type)) return setMsg("Use PNG, JPG, SVG ou WEBP");
    if (f.size > 2 * 1024 * 1024) return setMsg("Logo até 2 MB");
    setMsg("Enviando…");
    const supabase = createClient();
    const ext = f.name.split(".").pop()?.toLowerCase().replace(/[^a-z]/g, "") || "png";
    const path = `empresas/${companyId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("assets").upload(path, f, { contentType: f.type, upsert: true });
    if (error) return setMsg(error.message);
    setUrl(supabase.storage.from("assets").getPublicUrl(path).data.publicUrl);
    setMsg("Logo enviado. Clique em Salvar.");
  }
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="Logo" className="h-full w-full object-contain p-1" /> : <span className="font-mono text-[10px] uppercase text-muted-fg">sem logo</span>}
      </div>
      <div>
        <input type="hidden" name="logo_url" value={url} />
        <label className="btn-secondary inline-flex cursor-pointer !py-2">Enviar logo<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
        <p className="mt-1 text-xs text-muted-fg">{msg ?? "Aparece no portal, na landing page e nos materiais."}</p>
      </div>
    </div>
  );
}
