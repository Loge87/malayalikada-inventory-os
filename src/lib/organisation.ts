import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves the signed-in user's `organisation_id` from their `user_roles` row.
 *
 * `user_roles` is itself RLS-scoped to the caller, so this only ever returns the
 * current user's own organisation. Several tables (`locations`, `products`,
 * `product_variants`, …) have an INSERT RLS policy whose `WITH CHECK` requires
 * `organisation_id` to equal this value, so it must be set explicitly on insert.
 *
 * Returns `null` when there is no session or no role assignment.
 */
export async function getCurrentOrganisationId(
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
    .select("organisation_id")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return data.organisation_id as string;
}
