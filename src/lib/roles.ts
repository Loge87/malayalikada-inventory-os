import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentUser } from "@/lib/supabase/get-current-user";

/**
 * The signed-in user's role, straight from user_roles — mirrors
 * getCurrentOrganisationId's shape/structure (same table, sibling column).
 * Returns null when there's no session or no role row, same as that
 * function. Used by server actions/pages that need to gate an action by
 * role (see lib/permissions.ts) — RLS scopes this read to the caller's own
 * row regardless.
 *
 * Resolves the user via getCurrentUser() (React cache()-memoized) rather
 * than its own supabase.auth.getUser() call — that's a real network round
 * trip to Supabase's Auth API, not a local JWT decode, and nearly every
 * caller of this function already called getCurrentUser() once earlier in
 * the same request (the page's own auth guard). Reusing it here means this
 * costs nothing extra in that — the overwhelmingly common — case, instead
 * of every page paying for a second (or, alongside
 * getCurrentOrganisationId, third) redundant auth round trip.
 */
export async function getCurrentUserRole(
  supabase: SupabaseClient
): Promise<string | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return data.role as string;
}
