"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { COMPANY_COOKIE, listMyCompanies } from "@/lib/company";

/** Troca a empresa ativa (só aceita empresas que o usuário enxerga). */
export async function switchCompany(formData: FormData) {
  const id = String(formData.get("company_id") ?? "");
  const ok = (await listMyCompanies()).some((c) => c.id === id);
  if (ok) cookies().set(COMPANY_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  redirect("/painel");
}
