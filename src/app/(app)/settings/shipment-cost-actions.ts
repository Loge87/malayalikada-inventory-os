"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import {
  PRICE_VARIABLE_TYPES,
  type PriceVariableType,
} from "@/lib/price-variable-types";
import { PRODUCT_TYPES } from "@/lib/product-type";

export type ShipmentCostFormState = { error: string } | { ok: true } | undefined;

/** Saves the Frozen and Dry shipment costs together (one row per type). */
export async function saveShipmentCosts(
  _prevState: ShipmentCostFormState,
  formData: FormData
): Promise<ShipmentCostFormState> {
  const supabase = await createClient();

  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "pricing:manage")) {
    return { error: "Only an admin or owner can manage shipment costs." };
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const rows = [];
  for (const type of PRODUCT_TYPES) {
    const raw = String(formData.get(`${type}Value`) ?? "").trim();
    const value = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return { error: "Shipment costs must be a number, zero or more." };
    }
    const valueType = String(formData.get(`${type}Type`) ?? "number");
    if (!PRICE_VARIABLE_TYPES.includes(valueType as PriceVariableType)) {
      return { error: "Choose a value type for each shipment cost." };
    }
    rows.push({
      organisation_id: organisationId,
      product_type: type,
      value,
      value_type: valueType,
      updated_at: new Date().toISOString(),
    });
  }

  const { error } = await supabase
    .from("shipment_costs")
    .upsert(rows, { onConflict: "organisation_id,product_type" });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/products");
  return { ok: true };
}
