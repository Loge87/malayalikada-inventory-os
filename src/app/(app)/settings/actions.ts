"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import { CURRENCIES, type Currency } from "@/app/(app)/products/constants";

export type PriceSettingsState = { error: string } | { ok: true } | undefined;

/** [form field name, DB column, label] — retail and wholesale share this
 * shape; wholesale's form field names carry a "wholesale" prefix (see
 * price-settings-form.tsx) and map to the wholesale_* columns. */
const RATE_FIELDS = [
  ["CgstPercent", "cgst_percent", "CGST"],
  ["SgstPercent", "sgst_percent", "SGST"],
  ["ProfitMarginPercent", "profit_margin_percent", "Profit margin"],
  ["LogisticsChargesPercent", "logistics_charges_percent", "Logistics charges"],
  ["AdditionalChargesPercent", "additional_charges_percent", "Additional charges"],
] as const;

/** Parses one rate set's five fields off formData, prefixed ("retail" or
 * "wholesale") both in the form field name and the error label, so retail
 * and wholesale validate identically without duplicating this loop twice. */
function parseRateSet(
  formData: FormData,
  prefix: "retail" | "wholesale"
): { error: string } | { value: Record<string, number> } {
  const values: Record<string, number> = {};
  for (const [fieldSuffix, column, label] of RATE_FIELDS) {
    const field = `${prefix}${fieldSuffix}`;
    const dbColumn = prefix === "retail" ? column : `wholesale_${column}`;
    const raw = String(formData.get(field) ?? "").trim();
    const value = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      const prefixLabel = prefix === "retail" ? "Retail" : "Wholesale";
      return { error: `${prefixLabel} ${label} must be a non-negative number.` };
    }
    values[dbColumn] = value;
  }
  return { value: values };
}

/**
 * Persists the organisation's price settings — two independent rate sets
 * (retail and wholesale: CGST, SGST, profit margin, logistics charges,
 * additional charges, all percentages), plus whether wholesale should
 * mirror retail instead of using its own rate set. Read by the retail/
 * wholesale price calculation everywhere it's shown (products list, detail
 * panel, /scan) — see src/lib/price-calculation.ts.
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

  const retailResult = parseRateSet(formData, "retail");
  if ("error" in retailResult) return retailResult;

  const wholesaleResult = parseRateSet(formData, "wholesale");
  if ("error" in wholesaleResult) return wholesaleResult;

  const wholesaleUsesSameAsRetail = formData.get("wholesaleUsesSameAsRetail") === "on";

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

  const { error } = await supabase.from("price_settings").upsert(
    {
      organisation_id: organisationId,
      updated_at: new Date().toISOString(),
      ...retailResult.value,
      ...wholesaleResult.value,
      wholesale_use_same_as_retail: wholesaleUsesSameAsRetail,
    },
    { onConflict: "organisation_id" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}
