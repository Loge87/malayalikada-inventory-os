"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import type { RecordStockOutState } from "@/app/(app)/stock-out/constants";

/**
 * Records a stock-out: validates the caller is actually assigned to the
 * selected location (never trusts the dropdown's own client-side filtering),
 * then delegates the atomic insert-movement-backfill sequence to
 * record_stock_out (0024_stock_out.sql, made SECURITY DEFINER in
 * 0026_stock_out_security_definer.sql) — including the on_hand sufficiency
 * check, so "Only X units available at Y" comes straight from that RPC's
 * error message.
 */
export async function recordStockOut(
  _prevState: RecordStockOutState,
  formData: FormData
): Promise<RecordStockOutState> {
  const locationId = String(formData.get("locationId") ?? "");
  const productVariantId = String(formData.get("productVariantId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const quantityRaw = String(formData.get("quantity") ?? "").trim();

  if (!productVariantId) {
    return { error: "Missing product." };
  }
  if (!locationId) {
    return { error: "Choose a location." };
  }
  if (!clientId) {
    return { error: "Choose a client." };
  }
  const quantity = Number(quantityRaw);
  if (!quantityRaw || !Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Enter a quantity greater than zero." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  // Re-fetched here rather than trusted from the client — the Location
  // dropdown already only shows this user's assigned + active locations,
  // but that's a UI convenience, not the actual check. Only active
  // locations count: an assignment to a since-deactivated location isn't a
  // usable one.
  const { data: assignedLocations, error: assignedError } = await supabase
    .from("user_locations")
    .select("location_id, locations!inner(is_active)")
    .eq("user_id", user.id)
    .eq("locations.is_active", true);
  if (assignedError) {
    return { error: assignedError.message };
  }
  if (!assignedLocations || assignedLocations.length === 0) {
    return {
      error:
        "You're not assigned to any location yet — ask an admin to assign one under Settings > Team.",
    };
  }
  if (!assignedLocations.some((row) => row.location_id === locationId)) {
    return { error: "You're not assigned to that location." };
  }

  const { error } = await supabase.rpc("record_stock_out", {
    p_organisation_id: organisationId,
    p_location_id: locationId,
    p_product_variant_id: productVariantId,
    p_client_id: clientId,
    p_quantity: quantity,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/stock-out");
  return { ok: true };
}
