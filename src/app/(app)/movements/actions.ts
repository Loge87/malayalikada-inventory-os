"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import {
  MOVEMENT_TYPES,
  type MovementFormState,
  type MovementType,
} from "@/app/(app)/movements/constants";

export async function recordMovement(
  _prevState: MovementFormState,
  formData: FormData
): Promise<MovementFormState> {
  const locationId = String(formData.get("locationId") ?? "");
  const productVariantId = String(formData.get("productVariantId") ?? "");
  const movementType = String(formData.get("movementType") ?? "");
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const batchNumber = String(formData.get("batchNumber") ?? "").trim();
  const expiryDate = String(formData.get("expiryDate") ?? "").trim();

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

  // Batch/expiry only apply to received stock.
  const isReceipt = movementType === "PURCHASE_RECEIVED";
  if (!isReceipt && (batchNumber || expiryDate)) {
    return { error: "Batch and expiry only apply to received stock." };
  }
  if (expiryDate && !batchNumber) {
    return { error: "A batch number is required to record an expiry date." };
  }

  const supabase = await createClient();

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  // Stock changes must go through the ledger function only — never a direct
  // write to `inventory_movements` or `inventory_levels`. The function inserts
  // the movement row (setting `created_by` etc.), updates the derived
  // `inventory_levels` aggregate, and — for a PURCHASE_RECEIVED movement that
  // carries a batch number — creates the matching `inventory_batches` row.
  //
  // Signature (supabase/migrations/0005_inventory_batches.sql):
  //   record_inventory_movement(
  //     p_organisation_id, p_location_id, p_product_variant_id,
  //     p_movement_type, p_quantity,
  //     p_reference_type, p_reference_id, p_external_reference, p_note,
  //     p_batch_number, p_expiry_date
  //   )
  // p_batch_number / p_expiry_date are only sent for a receipt; omitting them
  // leaves the pre-batch behaviour unchanged.
  const { error } = await supabase.rpc("record_inventory_movement", {
    p_organisation_id: organisationId,
    p_location_id: locationId,
    p_product_variant_id: productVariantId,
    p_movement_type: movementType,
    p_quantity: quantity,
    ...(isReceipt && batchNumber
      ? { p_batch_number: batchNumber, p_expiry_date: expiryDate || null }
      : {}),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/movements");
  return { ok: true };
}
