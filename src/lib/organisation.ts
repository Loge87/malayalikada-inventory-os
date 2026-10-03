import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentUser } from "@/lib/supabase/get-current-user";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  type Currency,
} from "@/app/(app)/products/constants";

/**
 * Resolves the signed-in user's `organisation_id` from their `user_roles` row.
 *
 * `user_roles` is itself RLS-scoped to the caller, so this only ever returns the
 * current user's own organisation. Several tables (`locations`, `products`,
 * `product_variants`, …) have an INSERT RLS policy whose `WITH CHECK` requires
 * `organisation_id` to equal this value, so it must be set explicitly on insert.
 *
 * Returns `null` when there is no session or no role assignment.
 *
 * Resolves the user via getCurrentUser() (React cache()-memoized) rather
 * than its own supabase.auth.getUser() call — same reasoning as
 * getCurrentUserRole (lib/roles.ts): a real Auth API round trip, not a
 * local decode, and nearly every caller already resolved the user once
 * earlier in the same request.
 */
export async function getCurrentOrganisationId(
  supabase: SupabaseClient
): Promise<string | null> {
  const user = await getCurrentUser();

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

/**
 * The organisation's configured default currency (organisations.
 * default_currency, 0017_*.sql) — the pre-filled default for a NEW
 * product/variant's currency field going forward, nothing more. It never
 * overrides an existing variant's own stored currency; see that
 * migration's header comment for the full reasoning. Falls back to
 * DEFAULT_CURRENCY if the row is missing or holds a value outside the
 * current CURRENCIES list (defensive only — the column is NOT NULL with a
 * valid default, so this should never actually happen in practice).
 */
export async function getOrganisationDefaultCurrency(
  supabase: SupabaseClient,
  organisationId: string
): Promise<Currency> {
  const { data } = await supabase
    .from("organisations")
    .select("default_currency")
    .eq("id", organisationId)
    .single();

  const value = data?.default_currency as string | undefined;
  return CURRENCIES.includes(value as Currency) ? (value as Currency) : DEFAULT_CURRENCY;
}
