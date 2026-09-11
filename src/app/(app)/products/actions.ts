"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  CURRENCIES,
  MAX_IMAGE_BYTES,
  PRODUCT_IMAGE_BUCKET,
  VARIANT_UNITS,
  type Currency,
  type ProductFormState,
  type VariantUnit,
} from "@/app/(app)/products/constants";

type Pricing = {
  currency: Currency;
  packPrice: number | null;
  unitsPerPack: number;
  unitPrice: number | null;
};

/** Currency + pack/unit price validation, shared by every place a variant's
 * price is set (create and edit alike). */
function parsePricing(formData: FormData): { error: string } | { value: Pricing } {
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

  return { value: { currency: currency as Currency, packPrice, unitsPerPack, unitPrice } };
}

type PricingAndStock = Pricing & {
  initialLocationId: string | null;
  initialQuantity: number | null;
};

/**
 * Pricing + optional initial-stock fields for CREATING a variant, shared by
 * every variant-creation entry point (the /products "add variant" form and
 * the unified add-product flow).
 */
function parsePricingAndStock(
  formData: FormData
): { error: string } | { value: PricingAndStock } {
  const pricing = parsePricing(formData);
  if ("error" in pricing) {
    return pricing;
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
    value: { ...pricing.value, initialLocationId, initialQuantity },
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
 * Update an existing variant's identity + pricing fields. Catalog data, not
 * ledger-controlled — a direct update, RLS-scoped like every other product
 * write. Stock changes still only ever happen through record_inventory_movement
 * (via /movements, /transfers, /stock-counts, receiving a PO, etc.), never here.
 */
export async function updateVariant(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const variantId = String(formData.get("variantId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const unit = String(formData.get("unit") ?? "");

  if (!variantId) {
    return { error: "Missing variant." };
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

  const parsed = parsePricing(formData);
  if ("error" in parsed) {
    return parsed;
  }
  const { value: pricing } = parsed;

  const supabase = await createClient();
  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const { error } = await supabase
    .from("product_variants")
    .update({
      name,
      sku,
      barcode: barcode || null,
      unit,
      currency: pricing.currency,
      pack_price: pricing.packPrice,
      units_per_pack: pricing.unitsPerPack,
      unit_price: pricing.unitPrice,
    })
    .eq("id", variantId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  return { ok: true };
}

/**
 * Update a product's own fields (name, category, brand) and, optionally,
 * upload a new image to the private product-images bucket and point
 * image_url at it. Uses the request-scoped server client, so the upload is
 * RLS-scoped to the caller's org exactly like every DB write.
 */
export async function updateProduct(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const productId = String(formData.get("productId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const imageFile = formData.get("image");

  if (!productId) {
    return { error: "Missing product." };
  }
  if (!name) {
    return { error: "Product name is required." };
  }
  if (!category) {
    return { error: "Category is required." };
  }

  const supabase = await createClient();
  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  let imagePath: string | undefined; // undefined = leave image_url alone
  const hasNewImage = imageFile instanceof File && imageFile.size > 0;

  if (hasNewImage) {
    const file = imageFile as File;
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
      return { error: "Image must be a PNG, JPEG, or WEBP file." };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { error: "Image must be 5MB or smaller." };
    }

    const { data: existing } = await supabase
      .from("products")
      .select("image_url")
      .eq("id", productId)
      .single();

    const extension =
      file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${organisationId}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      return { error: uploadError.message };
    }

    // Best-effort cleanup of the previous image so the bucket doesn't
    // accumulate orphaned files. Not fatal if it fails.
    if (existing?.image_url) {
      await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([existing.image_url]);
    }

    imagePath = path;
  }

  const { error } = await supabase
    .from("products")
    .update({
      name,
      category,
      brand: brand || null,
      ...(imagePath !== undefined ? { image_url: imagePath } : {}),
    })
    .eq("id", productId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  return { ok: true };
}

/**
 * Create a product together with its first variant — the single entry point
 * for adding a new product, reached either by scanning a barcode (pre-filled)
 * or entering one manually, from /products directly or from /scan's
 * not-found screen. `returnTo` (set by the caller) sends a scan-originated
 * creation back to /scan, so the same barcode can be re-scanned and now
 * resolves; otherwise it returns to /products to see the new row.
 */
export async function createProductWithVariant(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const returnTo =
    String(formData.get("returnTo") ?? "") === "/scan" ? "/scan" : "/products";
  const productName = String(formData.get("productName") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
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
    p_brand: brand || null,
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
  redirect(returnTo);
}
