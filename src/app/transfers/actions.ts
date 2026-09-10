"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import type { TransferFormState } from "@/app/transfers/constants";

export async function createTransfer(
  _prevState: TransferFormState,
  formData: FormData
): Promise<TransferFormState> {
  const sourceLocationId = String(formData.get("sourceLocationId") ?? "");
  const destinationLocationId = String(
    formData.get("destinationLocationId") ?? ""
  );
  const productVariantId = String(formData.get("productVariantId") ?? "");
  const quantityRaw = String(formData.get("quantity") ?? "").trim();

  if (!sourceLocationId || !destinationLocationId) {
    return { error: "Choose a source and a destination location." };
  }
  if (sourceLocationId === destinationLocationId) {
    return { error: "Source and destination must be different." };
  }
  if (!productVariantId) {
    return { error: "Choose a product variant." };
  }

  const quantity = Number(quantityRaw);
  if (!quantityRaw || !Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Enter a positive quantity." };
  }

  const supabase = await createClient();

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  // One reference_id ties the TRANSFER_OUT and TRANSFER_IN rows together.
  const referenceId = randomUUID();

  // record_stock_transfer runs both record_inventory_movement calls in a
  // single transaction — TRANSFER_OUT (-qty) at the source, TRANSFER_IN (+qty)
  // at the destination. If either fails the whole thing rolls back, so the
  // source is never deducted unless the destination also receives the stock.
  // (supabase-js cannot span one transaction across two .rpc() calls, so the
  // pair is wrapped server-side — see supabase/migrations/0002_*.sql.)
  const { error } = await supabase.rpc("record_stock_transfer", {
    p_organisation_id: organisationId,
    p_source_location_id: sourceLocationId,
    p_destination_location_id: destinationLocationId,
    p_product_variant_id: productVariantId,
    p_quantity: quantity,
    p_reference_id: referenceId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/transfers");
  return { ok: true };
}
