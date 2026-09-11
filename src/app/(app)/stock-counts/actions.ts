"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import type { StockCountFormState } from "@/app/(app)/stock-counts/constants";

export async function startStockCount(
  _prevState: StockCountFormState,
  formData: FormData
): Promise<StockCountFormState> {
  const locationId = String(formData.get("locationId") ?? "");
  if (!locationId) {
    return { error: "Choose a location." };
  }

  const supabase = await createClient();
  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  // start_stock_count opens the count and snapshots every variant held at the
  // location into stock_count_items, atomically.
  const { error } = await supabase.rpc("start_stock_count", {
    p_organisation_id: organisationId,
    p_location_id: locationId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/stock-counts");
  return { ok: true };
}

type CountEntry = { item_id: string; counted_quantity: number | null };

function parseCounts(raw: string): CountEntry[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) {
    return null;
  }

  return parsed
    .map((entry) => {
      const record = (entry ?? {}) as Record<string, unknown>;
      const rawQty = record.counted_quantity;
      const quantity =
        rawQty === null || rawQty === undefined || rawQty === ""
          ? null
          : Number(rawQty);
      return {
        item_id: String(record.item_id ?? ""),
        counted_quantity:
          quantity !== null && Number.isFinite(quantity) ? quantity : null,
      };
    })
    .filter((entry) => entry.item_id.length > 0);
}

export async function saveStockCount(
  _prevState: StockCountFormState,
  formData: FormData
): Promise<StockCountFormState> {
  const stockCountId = String(formData.get("stockCountId") ?? "");
  const intent = String(formData.get("intent") ?? "save");
  const counts = parseCounts(String(formData.get("counts") ?? "[]"));

  if (!stockCountId) {
    return { error: "Missing stock count." };
  }
  if (counts === null) {
    return { error: "Invalid count data." };
  }

  const supabase = await createClient();
  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  // "save" just persists the entered counts. "complete" persists them, records
  // one ADJUSTMENT ledger movement per discrepancy, and closes the count — all
  // in one transaction inside complete_stock_count.
  const fn =
    intent === "complete" ? "complete_stock_count" : "save_stock_count_counts";

  const { error } = await supabase.rpc(fn, {
    p_organisation_id: organisationId,
    p_stock_count_id: stockCountId,
    p_counts: counts,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/stock-counts");
  return { ok: true };
}
