import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Returns the authenticated user + profile, or redirects to /login.
 * Use in protected server layouts/pages.
 */
export async function requireSession(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { userId: user.id, email: user.email ?? null, profile };
}

export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === "admin";
}
