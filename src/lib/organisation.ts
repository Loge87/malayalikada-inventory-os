import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  type Currency,
} from "@/app/(app)/products/constants";
import type { PriceSettingsRates } from "@/lib/price-calculation";

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

/** The organisation's saved Price Settings — retail and wholesale are
 *  independent rate sets (price_settings, 0019_*.sql); wholesaleUsesSameAsRetail
 *  says whether wholesale should resolve to retail's rates instead (see
 *  resolveWholesaleRates() in price-calculation.ts). */
export type OrganisationPriceSettings = {
  retail: PriceSettingsRates;
  wholesale: PriceSettingsRates;
  wholesaleUsesSameAsRetail: boolean;
};

/**
 * The organisation's saved Price Settings, or null when the organisation has
 * never saved any — the signal every retail/wholesale-price display uses to
 * show a "Set price settings" fallback instead of a calculation with no real
 * inputs. Once a row exists (even one saved with every field left at 0),
 * this returns real rates and the calculation proceeds normally.
 */
export async function getOrganisationPriceSettings(
  supabase: SupabaseClient,
  organisationId: string
): Promise<OrganisationPriceSettings | null> {
  const { data } = await supabase
    .from("price_settings")
    .select(
      "cgst_percent, sgst_percent, profit_margin_percent, logistics_charges_percent, additional_charges_percent, wholesale_cgst_percent, wholesale_sgst_percent, wholesale_profit_margin_percent, wholesale_logistics_charges_percent, wholesale_additional_charges_percent, wholesale_use_same_as_retail"
    )
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (!data) return null;

  return {
    retail: {
      cgstPercent: data.cgst_percent,
      sgstPercent: data.sgst_percent,
      profitMarginPercent: data.profit_margin_percent,
      logisticsChargesPercent: data.logistics_charges_percent,
      additionalChargesPercent: data.additional_charges_percent,
    },
    wholesale: {
      cgstPercent: data.wholesale_cgst_percent,
      sgstPercent: data.wholesale_sgst_percent,
      profitMarginPercent: data.wholesale_profit_margin_percent,
      logisticsChargesPercent: data.wholesale_logistics_charges_percent,
      additionalChargesPercent: data.wholesale_additional_charges_percent,
    },
    wholesaleUsesSameAsRetail: data.wholesale_use_same_as_retail,
  };
}
