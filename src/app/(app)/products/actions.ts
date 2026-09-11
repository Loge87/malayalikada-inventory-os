"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import {
  CURRENCIES,
  VARIANT_UNITS,
  type Currency,
  type ProductFormState,
  type VariantUnit,
} from "@/app/(app)/products/constants";

export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!name) {
    return { error: "Name is required." };
  }
  if (!category) {
    return { error: "Category is required." };
  }

  const supabase = await createClient();

  const organisationId = await getCurrentOrganisationId(supabase);

  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  // The `products` RLS policy requires `organisation_id` to match the caller's
  // org, so it is set explicitly. Products are not ledger-controlled (only stock
  // movements are), so a direct insert is fine.
  const { error } = await supabase
    .from("products")
    .insert({ name, category, organisation_id: organisationId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  return { ok: true };
}

type PricingAndStock = {
  currency: Currency;
  packPrice: number | null;
  unitsPerPack: number;
  unitPrice: number | null;
  initialLocationId: string | null;
  initialQuantity: number | null;
};

/**
 * Parses and validates the pricing + optional initial-stock fields shared by
 * both variant-creation entry points (the /products "add variant" form and
 * the /products/new scan flow), so the two forms are validated identically.
 */
function parsePricingAndStock(
  formData: FormData
): { error: string } | { value: PricingAndStock } {
  const currency = String(formData.get("currency") ?? "").trim();
  if (!CURRENCIES.includes(currency as Currency)) {
    return { error: "Choose a currency." };
  }

  const packPriceRaw = String(formData.get("packPrice") ?? "").trim();
  const packPrice = packPriceRaw === "" ? null : Number(packPriceRaw);
  if (packPrice !== null && (!Number.isFinite(packPrice) || packPrice < 0)) {
    return { error: "Pack price must be a non-negative number." };
  }

  const unitsPerPackRaw = String(formData.get("unitsPerPack") ?? "1").trim();
  const unitsPerPack = unitsPerPackRaw === "" ? 1 : Number(unitsPerPackRaw);
  if (!Number.isFinite(unitsPerPack) || unitsPerPack <= 0) {
    return { error: "Units per pack must be a positive number." };
  }

  const unitPriceRaw = String(formData.get("unitPrice") ?? "").trim();
  const unitPrice = unitPriceRaw === "" ? null : Number(unitPriceRaw);
  if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
    return { error: "Unit price must be a non-negative number." };
  }

  const initialLocationId =
    String(formData.get("initialLocationId") ?? "").trim() || null;
  const initialQuantityRaw = String(
    formData.get("initialQuantity") ?? ""
  ).trim();
  const initialQuantity =
    initialQuantityRaw === "" ? null : Number(initialQuantityRaw);
  if (
    initialQuantity !== null &&
    (!Number.isFinite(initialQuantity) || initialQuantity <= 0)
  ) {
    return { error: "Initial quantity must be a positive number." };
  }
  if (initialQuantity !== null && !initialLocationId) {
    return { error: "Choose a location for the initial stock." };
  }
  if (initialLocationId && initialQuantity === null) {
    return { error: "Enter an initial quantity for the selected location." };
  }

  return {
    value: {
      currency: currency as Currency,
      packPrice,
      unitsPerPack,
      unitPrice,
      initialLocationId,
      initialQuantity,
    },
  };
}

export async function createVariant(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const productId = String(formData.get("productId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const unit = String(formData.get("unit") ?? "");

  if (!productId) {
    return { error: "Missing product." };
  }
  if (!name) {
    return { error: "Variant name is required." };
  }
  if (!sku) {
    return { error: "SKU is required." };
  }
  if (!VARIANT_UNITS.includes(unit as VariantUnit)) {
    return { error: "Choose a unit." };
  }

  const parsed = parsePricingAndStock(formData);
  if ("error" in parsed) {
    return parsed;
  }
  const { value: extra } = parsed;

  const supabase = await createClient();

  const organisationId = await getCurrentOrganisationId(supabase);

  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  // create_product_variant inserts the variant and, if a location + quantity
  // were given, records the opening stock through record_inventory_movement
  // (PURCHASE_RECEIVED, reference_type 'initial_stock') — never a direct write
  // to inventory_levels. One transaction; RLS also checks that `product_id`
  // belongs to the caller's org.
  const { error } = await supabase.rpc("create_product_variant", {
    p_organisation_id: organisationId,
    p_product_id: productId,
    p_name: name,
    p_sku: sku,
    p_barcode: barcode || null,
    p_unit: unit,
    p_currency: extra.currency,
    p_pack_price: extra.packPrice,
    p_units_per_pack: extra.unitsPerPack,
    p_unit_price: extra.unitPrice,
    p_initial_location_id: extra.initialLocationId,
    p_initial_quantity: extra.initialQuantity,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  return { ok: true };
}

/**
 * Create a product together with its first variant — used by the scan flow when
 * a barcode matches nothing. On success, redirect back to /scan so the same
 * barcode can be re-scanned and now resolves.
 */
export async function createProductWithVariant(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const productName = String(formData.get("productName") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const variantName = String(formData.get("variantName") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const unit = String(formData.get("unit") ?? "");

  if (!productName) {
    return { error: "Product name is required." };
  }
  if (!category) {
    return { error: "Category is required." };
  }
  if (!variantName) {
    return { error: "Variant name is required." };
  }
  if (!sku) {
    return { error: "SKU is required." };
  }
  if (!VARIANT_UNITS.includes(unit as VariantUnit)) {
    return { error: "Choose a unit." };
  }

  const parsed = parsePricingAndStock(formData);
  if ("error" in parsed) {
    return parsed;
  }
  const { value: extra } = parsed;

  const supabase = await createClient();

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  // create_product_with_variant creates the product, then delegates to
  // create_product_variant for the variant + optional initial stock — the
  // same function the /products "add variant" form uses — all in one
  // transaction, so there's no orphaned product if anything fails.
  const { error } = await supabase.rpc("create_product_with_variant", {
    p_organisation_id: organisationId,
    p_product_name: productName,
    p_category: category,
    p_variant_name: variantName,
    p_sku: sku,
    p_barcode: barcode || null,
    p_unit: unit,
    p_currency: extra.currency,
    p_pack_price: extra.packPrice,
    p_units_per_pack: extra.unitsPerPack,
    p_unit_price: extra.unitPrice,
    p_initial_location_id: extra.initialLocationId,
    p_initial_quantity: extra.initialQuantity,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  revalidatePath("/scan");
  redirect("/scan");
}
