"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import { CURRENCIES, type Currency } from "@/app/(app)/products/constants";

export type PriceSettingsState = { error: string } | { ok: true } | undefined;

const FIELDS = [
  ["cgstPercent", "cgst_percent", "CGST"],
  ["sgstPercent", "sgst_percent", "SGST"],
  ["profitMarginPercent", "profit_margin_percent", "Profit margin"],
  ["logisticsChargesPercent", "logistics_charges_percent", "Logistics charges"],
  ["additionalChargesPercent", "additional_charges_percent", "Additional charges"],
] as const;

/**
 * Persists the organisation's price settings — CGST, SGST, profit margin,
 * logistics charges, additional charges, all percentages. Not read by any
 * retail/wholesale calculation yet; this just captures and stores the
 * values for a future step.
 */
export async function savePriceSettings(
  _prevState: PriceSettingsState,
  formData: FormData
): Promise<PriceSettingsState> {
  const supabase = await createClient();

  // Page is already gated to admin/owner, but this is reachable directly as
  // a server action too — same belt-and-suspenders re-check every other
  // permission-gated action in this codebase does.
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "pricing:manage")) {
    return { error: "Only an admin or owner can manage price settings." };
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const currency = String(formData.get("currency") ?? "").trim();
  if (!CURRENCIES.includes(currency as Currency)) {
    return { error: "Choose a currency." };
  }

  const values: Record<string, number> = {};
  for (const [field, column, label] of FIELDS) {
    const raw = String(formData.get(field) ?? "").trim();
    const value = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return { error: `${label} must be a non-negative number.` };
    }
    values[column] = value;
  }

  // Two separate writes, not one transaction — organisations.default_currency
  // and price_settings are different tables with no cross-table invariant to
  // protect (each is independently valid on its own), the same "plain
  // sequential writes, no RPC wrapper" pattern the rest of this codebase uses
  // outside the inventory ledger, where atomicity actually matters.
  const { error: orgError } = await supabase
    .from("organisations")
    .update({ default_currency: currency })
    .eq("id", organisationId);
  if (orgError) {
    return { error: orgError.message };
  }

  const { error } = await supabase
    .from("price_settings")
    .upsert(
      { organisation_id: organisationId, updated_at: new Date().toISOString(), ...values },
      { onConflict: "organisation_id" }
    );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}
