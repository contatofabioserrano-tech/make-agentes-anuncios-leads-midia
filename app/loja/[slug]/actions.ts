"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getListing } from "@/lib/marketplace/listings";

const clip = (v: FormDataEntryValue | null, n: number) => {
  const s = String(v ?? "").trim().slice(0, n);
  return s || null;
};

/** Grava o lead da landing page em public.mk_leads (insert anônimo; ninguém de fora consegue ler). */
export async function sendLead(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  if (!getListing(slug)) redirect("/");
  const back = `/loja/${slug}`;
  if (formData.get("site")) redirect(`${back}?lead=ok#contato`); // honeypot: robô preencheu o campo oculto
  const name = clip(formData.get("name"), 120);
  const email = clip(formData.get("email"), 160);
  const phone = clip(formData.get("phone"), 30);
  if (!name || name.length < 2 || (!email && !phone)) redirect(`${back}?lead=erro#contato`);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect(`${back}?lead=erro#contato`);
  const supabase = createClient();
  // produto -> empresa (Kairós para os anúncios do repositório)
  const { data: co } = await supabase.from("mk_companies_public").select("id").eq("slug", "kairos").maybeSingle();
  const { error } = await supabase.from("mk_leads").insert({
    slug, name, email, phone, ...(co?.id ? { company_id: co.id } : {}),
    company: clip(formData.get("company"), 160),
    quantity: clip(formData.get("quantity"), 60),
    message: clip(formData.get("message"), 1000),
    source: clip(headers().get("referer"), 200),
  });
  if (error) console.error("[lead] falhou:", error.message);
  redirect(`${back}?lead=${error ? "erro" : "ok"}#contato`);
}
