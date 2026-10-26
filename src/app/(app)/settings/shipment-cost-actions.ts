"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
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
    if (valueType !== "number" && valueType !== "percentage") {
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

/** Adds or removes a product type's shipment cost from one formula
 *  (retail or wholesale). The cost itself is kept; only this formula's use of it changes. */
export async function setShipmentApplies(
  formulaType: "retail" | "wholesale",
  productType: string,
  enabled: boolean
): Promise<ShipmentCostFormState> {
  if (formulaType !== "retail" && formulaType !== "wholesale") return { error: "Unknown formula." };
  if (!(PRODUCT_TYPES as readonly string[]).includes(productType)) return { error: "Unknown product type." };

  const supabase = await createClient();
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "pricing:manage")) {
    return { error: "Only an admin or owner can manage shipment costs." };
  }
  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) return { error: "Could not determine your organisation." };

  const column = formulaType === "retail" ? "retail_enabled" : "wholesale_enabled";
  const { error } = await supabase
    .from("shipment_costs")
    .upsert(
      { organisation_id: organisationId, product_type: productType, [column]: enabled, updated_at: new Date().toISOString() },
      { onConflict: "organisation_id,product_type" }
    );
  if (error) {
    return { error: error.message.includes(column) ? "Run migration 0036 in Supabase first." : error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/products");
  return { ok: true };
}
