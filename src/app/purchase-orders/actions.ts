"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import type { PurchaseOrderFormState } from "@/app/purchase-orders/constants";

type ParsedLineItem = {
  product_variant_id: string;
  quantity_ordered: number;
};

function parseLineItems(raw: string): ParsedLineItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return {
        product_variant_id: String(record.product_variant_id ?? ""),
        quantity_ordered: Number(record.quantity_ordered),
      };
    })
    .filter(
      (item) =>
        item.product_variant_id.length > 0 &&
        Number.isFinite(item.quantity_ordered) &&
        item.quantity_ordered > 0
    );
}

export async function createPurchaseOrder(
  _prevState: PurchaseOrderFormState,
  formData: FormData
): Promise<PurchaseOrderFormState> {
  const supplierName = String(formData.get("supplierName") ?? "").trim();
  const destinationLocationId = String(
    formData.get("destinationLocationId") ?? ""
  );
  const items = parseLineItems(String(formData.get("items") ?? "[]"));

  if (!supplierName) {
    return { error: "Supplier name is required." };
  }
  if (!destinationLocationId) {
    return { error: "Choose a destination location." };
  }
  if (items.length === 0) {
    return {
      error: "Add at least one line item with a variant and a quantity.",
    };
  }

  const supabase = await createClient();

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const { data: purchaseOrder, error: headerError } = await supabase
    .from("purchase_orders")
    .insert({
      organisation_id: organisationId,
      supplier_name: supplierName,
      destination_location_id: destinationLocationId,
    })
    .select("id")
    .single();

  if (headerError || !purchaseOrder) {
    return {
      error: headerError?.message ?? "Could not create the purchase order.",
    };
  }

  const { error: itemsError } = await supabase.from("purchase_order_items").insert(
    items.map((item) => ({
      organisation_id: organisationId,
      purchase_order_id: purchaseOrder.id,
      product_variant_id: item.product_variant_id,
      quantity_ordered: item.quantity_ordered,
    }))
  );

  if (itemsError) {
    // Best-effort cleanup of the header we just created so we don't leave a PO
    // with no line items.
    await supabase.from("purchase_orders").delete().eq("id", purchaseOrder.id);
    return { error: itemsError.message };
  }

  revalidatePath("/purchase-orders");
  return { ok: true };
}

export async function receivePurchaseOrder(
  _prevState: PurchaseOrderFormState,
  formData: FormData
): Promise<PurchaseOrderFormState> {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  if (!purchaseOrderId) {
    return { error: "Missing purchase order." };
  }

  const supabase = await createClient();

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  // receive_purchase_order records one PURCHASE_RECEIVED movement per line item
  // (reference_type 'purchase_order', reference_id = the PO id) and flips the
  // PO to 'received', all in a single transaction. It raises if the PO is not
  // still 'draft', so a double-click cannot receive the stock twice.
  const { error } = await supabase.rpc("receive_purchase_order", {
    p_organisation_id: organisationId,
    p_purchase_order_id: purchaseOrderId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/purchase-orders");
  return { ok: true };
}
