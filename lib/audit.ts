import { isLegacy } from "@/lib/company";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Registra um evento na trilha de auditoria (public.mk_audit_events).
 * Append-only: a RLS só permite inserir com actor_id = usuário logado; ninguém altera nem apaga pelo app.
 * Falha de auditoria não derruba a ação principal, mas fica no log do servidor.
 */
export async function logAudit(
  supabase: SupabaseClient,
  ev: { action: string; entity: string; entityId?: string | number; summary?: string; details?: Record<string, unknown>; companyId?: string | null },
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("mk_audit_events").insert({
    actor_id: user.id,
    actor_email: user.email ?? null,
    action: ev.action,
    entity: ev.entity,
    entity_id: ev.entityId !== undefined ? String(ev.entityId) : null,
    summary: ev.summary ?? null,
    details: ev.details ?? {},
    ...(ev.companyId && !isLegacy(ev.companyId) ? { company_id: ev.companyId } : {}),
  });
  if (error) console.error("[audit] falhou:", error.message, ev.action);
}
