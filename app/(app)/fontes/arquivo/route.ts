import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Abre um arquivo do bucket privado mk-fontes. A RLS do Storage só assina se o usuário for da empresa dona da pasta. */
export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!/^[0-9a-f-]{36}\/[\w.\-]+$/i.test(path)) return NextResponse.json({ error: "caminho inválido" }, { status: 400 });
  const { data, error } = await createClient().storage.from("mk-fontes").createSignedUrl(path, 300);
  if (error || !data) return NextResponse.json({ error: "sem acesso" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
