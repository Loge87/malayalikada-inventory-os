"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import {
  MOVEMENT_TYPES,
  type MovementFormState,
  type MovementType,
} from "@/app/movements/constants";

export async function recordMovement(
  _prevState: MovementFormState,
  formData: FormData
): Promise<MovementFormState> {
  const locationId = String(formData.get("locationId") ?? "");
  const productVariantId = String(formData.get("productVariantId") ?? "");
  const movementType = String(formData.get("movementType") ?? "");
  const quantityRaw = String(formData.get("quantity") ?? "").trim();

  if (!locationId) {
    return { error: "Choose a location." };
  }
  if (!productVariantId) {
    return { error: "Choose a product variant." };
  }
  if (!MOVEMENT_TYPES.includes(movementType as MovementType)) {
    return { error: "Choose a movement type." };
  }

  const quantity = Number(quantityRaw);
  if (!quantityRaw || !Number.isFinite(quantity) || quantity === 0) {
    return { error: "Enter a non-zero quantity." };
  }

  const supabase = await createClient();

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  // Stock changes must go through the ledger function only — never a direct
  // write to `inventory_movements` or `inventory_levels`. The function inserts
  // the movement row (setting `created_by` etc.) and updates the derived
  // `inventory_levels` aggregate.
  //
  // Signature (supabase/migrations/0001_init.sql):
  //   record_inventory_movement(
  //     p_organisation_id, p_location_id, p_product_variant_id,
  //     p_movement_type, p_quantity,
  //     p_reference_type, p_reference_id, p_external_reference, p_note
  //   )
  // The last four are optional for manual entries and left to the function's
  // defaults for now.
  const { error } = await supabase.rpc("record_inventory_movement", {
    p_organisation_id: organisationId,
    p_location_id: locationId,
    p_product_variant_id: productVariantId,
    p_movement_type: movementType,
    p_quantity: quantity,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/movements");
  return { ok: true };
}
