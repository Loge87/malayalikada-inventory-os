import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The one query every barcode-driven flow uses to answer "does this barcode
 * belong to an active product, and what's its real availability" —
 * findExistingProductByBarcode (products/actions.ts, so the duplicate-check
 * behind checkBarcodeExists/AddProductMenu/BarcodeDuplicateField/
 * createProductWithVariant's own safety net), ScanLookup (/scan), and
 * StockOutLookup (/stock-out) all call this instead of each running their
 * own product_variants query.
 *
 * `products!inner(...)` + `.eq("products.is_active", true)` is the actual
 * fix: a variant whose PARENT PRODUCT is soft-deleted is excluded entirely,
 * not just labelled — a barcode that only belongs to a deactivated product
 * is treated exactly like a barcode that was never used. It's scannable and
 * creatable again (there's no DB uniqueness constraint on barcode — a new
 * active product can coexist with an old inactive one sharing the same
 * one), not a blocked "already exists".
 *
 * Works from both server code (products/actions.ts, passing the
 * request-scoped server client) and client components (ScanLookup/
 * StockOutLookup, passing the browser client) — plain function, no
 * "use server"/"use client" of its own.
 */

export type BarcodeMatchVariant = {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  currency: string;
  pack_price: number | null;
  units_per_pack: number;
  unit_price: number | null;
  products: { name: string; category: string | null } | null;
  inventory_levels: {
    on_hand: number;
    location_id: string;
    locations: { name: string; type: string } | null;
  }[];
};

/**
 * `organisationId` is optional — server callers pass it (explicit
 * defense-in-depth, matching every other server action in this codebase);
 * client callers omit it and rely on RLS alone, matching how ScanLookup's
 * own query already worked before this consolidation.
 */
export async function findActiveVariantsByBarcode(
  supabase: SupabaseClient,
  barcode: string,
  options: { organisationId?: string; limit?: number } = {}
): Promise<BarcodeMatchVariant[]> {
  let query = supabase
    .from("product_variants")
    .select(
      `id, product_id, name, sku, barcode, unit, currency, pack_price, units_per_pack, unit_price,
       products!inner(name, category, is_active),
       inventory_levels(on_hand, location_id, locations(name, type))`
    )
    .eq("barcode", barcode)
    .eq("products.is_active", true)
    .limit(options.limit ?? 2);

  if (options.organisationId) {
    query = query.eq("organisation_id", options.organisationId);
  }

  const { data, error } = await query.returns<BarcodeMatchVariant[]>();
  if (error) {
    throw error;
  }
  return data ?? [];
}

export type AnyStatusBarcodeMatch = {
  product_id: string;
  product_name: string;
  is_active: boolean;
};

/**
 * Unlike findActiveVariantsByBarcode above, this matches a barcode
 * regardless of the parent product's active status — used ONLY by the
 * duplicate-check (findExistingProductByBarcode, products/actions.ts),
 * which needs to tell "belongs to an active product" (a real duplicate,
 * blocked) apart from "belongs to a soft-deleted product" (offer to
 * reactivate that product instead of creating a second one sharing the
 * same barcode) — every other barcode lookup in the app only cares about
 * the active case and uses findActiveVariantsByBarcode instead.
 */
export async function findAnyVariantByBarcode(
  supabase: SupabaseClient,
  barcode: string,
  options: { organisationId?: string } = {}
): Promise<AnyStatusBarcodeMatch | null> {
  let query = supabase
    .from("product_variants")
    .select("product_id, products!inner(name, is_active)")
    .eq("barcode", barcode)
    .limit(1);

  if (options.organisationId) {
    query = query.eq("organisation_id", options.organisationId);
  }

  const { data, error } = await query.returns<
    { product_id: string; products: { name: string; is_active: boolean } | null }[]
  >();
  if (error) {
    throw error;
  }
  const row = data?.[0];
  if (!row) {
    return null;
  }
  return {
    product_id: row.product_id,
    product_name: row.products?.name ?? "that product",
    is_active: row.products?.is_active ?? true,
  };
}
