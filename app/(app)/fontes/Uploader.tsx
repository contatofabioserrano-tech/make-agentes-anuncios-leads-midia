"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerFile } from "./actions";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX = 50 * 1024 * 1024;

/** Envia fotos e PDFs direto do navegador para o bucket privado mk-fontes/<empresa>/. */
export function Uploader({ companyId }: { companyId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const router = useRouter();

  async function send(files: FileList | File[]) {
    const list = Array.from(files).slice(0, 30);
    if (!list.length) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    let ok = 0;
    const errs: string[] = [];
    for (const f of list) {
      if (!ACCEPT.split(",").includes(f.type)) { errs.push(`${f.name}: use JPG, PNG, WEBP ou PDF`); continue; }
      if (f.size > MAX) { errs.push(`${f.name}: maior que 50 MB`); continue; }
      const safe = f.name.normalize("NFD").replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `${companyId}/${crypto.randomUUID().slice(0, 8)}-${safe}`;
      const up = await supabase.storage.from("mk-fontes").upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) { errs.push(`${f.name}: ${up.error.message}`); continue; }
      const r = await registerFile({ path, name: f.name, mime: f.type, bytes: f.size });
      if (r?.error) errs.push(`${f.name}: ${r.error}`); else ok++;
    }
    setBusy(false);
    setMsg(`${ok} arquivo(s) enviado(s)${errs.length ? ` · ${errs.join(" · ")}` : ""}`);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files); }}
      className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${drag ? "border-kairos-red bg-kairos-red-soft" : "border-line bg-white"}`}
    >
      <p className="text-sm font-semibold text-ink">Arraste fotos e PDFs aqui</p>
      <p className="mt-1 text-xs text-muted-fg">Fotos do produto, catálogo do fabricante, ficha técnica, manual. JPG, PNG, WEBP ou PDF até 50 MB.</p>
      <label className="btn-secondary mt-3 inline-flex cursor-pointer">
        {busy ? "Enviando…" : "Escolher arquivos"}
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" disabled={busy} onChange={(e) => e.target.files && send(e.target.files)} />
      </label>
      {msg && <p role="status" className="mt-3 text-xs text-muted-fg">{msg}</p>}
    </div>
  );
}
