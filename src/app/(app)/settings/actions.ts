"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import { CURRENCIES, type Currency } from "@/app/(app)/products/constants";

export type SaveCurrencyState = { error: string } | { ok: true } | undefined;

/**
 * The organisation's default currency — General tab. Split out from the old
 * savePriceSettings (which used to save this alongside the now-removed
 * CGST/SGST/margin/logistics rate fields, see price-settings-form.tsx's
 * removal in the price formula builder rebuild) since currency isn't a
 * pricing-formula concept and the two tabs save independently now.
 */
export async function saveOrganisationCurrency(
  _prevState: SaveCurrencyState,
  formData: FormData
): Promise<SaveCurrencyState> {
  const supabase = await createClient();

  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "pricing:manage")) {
    return { error: "Only an admin or owner can manage settings." };
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const currency = String(formData.get("currency") ?? "").trim();
  if (!CURRENCIES.includes(currency as Currency)) {
    return { error: "Choose a currency." };
  }

  const { error } = await supabase
    .from("organisations")
    .update({ default_currency: currency })
    .eq("id", organisationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}
