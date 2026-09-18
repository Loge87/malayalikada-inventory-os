import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The signed-in user's role, straight from user_roles — mirrors
 * getCurrentOrganisationId's shape/structure (same table, sibling column).
 * Returns null when there's no session or no role row, same as that
 * function. Used by server actions/pages that need to gate an action by
 * role (see lib/permissions.ts) — RLS scopes this read to the caller's own
 * row regardless.
 */
export async function getCurrentUserRole(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
