"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
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

/**
 * Validates and uploads a product image, shared by the create and edit
 * flows so the mime/size rules and storage path scheme (organisation_id/
 * uuid.ext — see 0011_product_images.sql) live in one place. Returns the
 * new object's storage path on success.
 */
async function uploadProductImage(
  supabase: SupabaseClient,
  organisationId: string,
  file: File
): Promise<{ error: string } | { path: string }> {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return { error: "Image must be a PNG, JPEG, or WEBP file." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Image must be 5MB or smaller." };
  }

  const extension =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${organisationId}/${randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type });

  if (error) {
    return { error: error.message };
  }
  return { path };
}

type Pricing = {
  currency: Currency;
  packPrice: number | null;
  unitsPerPack: number;
  unitPrice: number | null;
};

/** A non-negative-or-empty price field, shared by pack/unit price — both
 * are optional and validated identically. retail_price and wholesale_price
 * aren't among them: both are calculated (src/lib/price-calculation.ts),
 * never entered. */
function parseOptionalPrice(
  formData: FormData,
  field: string,
  label: string
): { error: string } | { value: number | null } {
  const raw = String(formData.get(field) ?? "").trim();
  const value = raw === "" ? null : Number(raw);
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    return { error: `${label} must be a non-negative number.` };
  }
  return { value };
}

/** Currency + pack/unit price validation, shared by every place a variant's
 * price is set (create and edit alike). */
function parsePricing(formData: FormData): { error: string } | { value: Pricing } {
  const currency = String(formData.get("currency") ?? "").trim();
  if (!CURRENCIES.includes(currency as Currency)) {
    return { error: "Choose a currency." };
  }

  const packPriceResult = parseOptionalPrice(formData, "packPrice", "Pack price");
  if ("error" in packPriceResult) return packPriceResult;

  const unitsPerPackRaw = String(formData.get("unitsPerPack") ?? "1").trim();
  const unitsPerPack = unitsPerPackRaw === "" ? 1 : Number(unitsPerPackRaw);
  if (!Number.isFinite(unitsPerPack) || unitsPerPack <= 0) {
    return { error: "Units per pack must be a positive number." };
  }

  const unitPriceResult = parseOptionalPrice(formData, "unitPrice", "Unit price");
  if ("error" in unitPriceResult) return unitPriceResult;

  return {
    value: {
      currency: currency as Currency,
      packPrice: packPriceResult.value,
      unitsPerPack,
      unitPrice: unitPriceResult.value,
    },
  };
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
    const uploaded = await uploadProductImage(supabase, organisationId, imageFile as File);
    if ("error" in uploaded) {
      return { error: uploaded.error };
    }

    // Best-effort cleanup of the previous image so the bucket doesn't
    // accumulate orphaned files. Not fatal if it fails.
    const { data: existing } = await supabase
      .from("products")
      .select("image_url")
      .eq("id", productId)
      .single();
    if (existing?.image_url) {
      await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([existing.image_url]);
    }

    imagePath = uploaded.path;
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

  const imageFile = formData.get("image");
  const hasImage = imageFile instanceof File && imageFile.size > 0;
  if (hasImage) {
    // Fail fast on an obviously-bad image before creating anything.
    const file = imageFile as File;
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
      return { error: "Image must be a PNG, JPEG, or WEBP file." };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { error: "Image must be 5MB or smaller." };
    }
  }

  const supabase = await createClient();

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  // create_product_with_variant creates the product, then delegates to
  // create_product_variant for the variant + optional initial stock — the
  // same function the /products "add variant" form uses — all in one
  // transaction, so there's no orphaned product if anything fails.
  const { data: variantId, error } = await supabase.rpc("create_product_with_variant", {
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

  // The RPC returns the new variant's id, not the product's — look the
  // product up to attach the image. Non-fatal: the product/variant is
  // already created at this point, so an image hiccup shouldn't block
  // success, just leave the product imageless.
  if (hasImage && variantId) {
    const { data: variantRow } = await supabase
      .from("product_variants")
      .select("product_id")
      .eq("id", variantId)
      .single();
    if (variantRow?.product_id) {
      const uploaded = await uploadProductImage(
        supabase,
        organisationId,
        imageFile as File
      );
      if ("path" in uploaded) {
        await supabase
          .from("products")
          .update({ image_url: uploaded.path })
          .eq("id", variantRow.product_id);
      }
    }
  }

  revalidatePath("/products");
  revalidatePath("/scan");
  // redirect() throws before this action's return value ever reaches the
  // client's useActionState, so the normal "check the result, fire a toast"
  // pattern can't apply here — the created name rides along in the query
  // string instead, read once on the landing page (see ProductCreatedToast).
  redirect(`${returnTo}?created=${encodeURIComponent(productName)}`);
}

export type DeleteProductState =
  | { error: string }
  | { ok: true; result: "deleted" | "deactivated" }
  | undefined;

/**
 * Deletes a product, or deactivates it if it can't be safely removed.
 * delete_product() checks every variant of the product for inventory_movements
 * or purchase_order_items referencing it: if any exist, it sets
 * products.is_active = false instead (movements are permanent audit history —
 * see the inventory rule in CLAUDE.md); otherwise it removes the product
 * (cascading to its variants).
 */
export async function deleteProduct(
  _prevState: DeleteProductState,
  formData: FormData
): Promise<DeleteProductState> {
  const productId = String(formData.get("productId") ?? "");
  if (!productId) {
    return { error: "Missing product." };
  }

  const supabase = await createClient();

  // UI-level permission model (lib/permissions.ts), checked here too since
  // the `products` RLS policy doesn't itself distinguish staff from admin —
  // it only scopes by organisation. Hiding the button isn't enough on its
  // own for an action RLS doesn't already restrict by role.
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "products:delete")) {
    return { error: "You don't have permission to delete products." };
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const { data, error } = await supabase.rpc("delete_product", {
    p_organisation_id: organisationId,
    p_product_id: productId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  return { ok: true, result: data as "deleted" | "deactivated" };
}

export type BulkDeleteState =
  | { error: string }
  | { ok: true; deleted: number; deactivated: number }
  | undefined;

/**
 * Runs delete_product for every selected product (the checkbox column in
 * ProductsTable) — same RPC and same deleted-vs-deactivated rule as a single
 * delete, just looped. One product's failure doesn't stop the rest; any
 * failures are surfaced together at the end.
 */
export async function bulkDeleteProducts(
  _prevState: BulkDeleteState,
  formData: FormData
): Promise<BulkDeleteState> {
  let productIds: unknown;
  try {
    productIds = JSON.parse(String(formData.get("productIds") ?? "[]"));
  } catch {
    return { error: "Malformed selection." };
  }
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return { error: "No products selected." };
  }

  const supabase = await createClient();

  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "products:delete")) {
    return { error: "You don't have permission to delete products." };
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  let deleted = 0;
  let deactivated = 0;
  const errors: string[] = [];

  for (const productId of productIds) {
    if (typeof productId !== "string") continue;
    const { data, error } = await supabase.rpc("delete_product", {
      p_organisation_id: organisationId,
      p_product_id: productId,
    });
    if (error) {
      errors.push(error.message);
      continue;
    }
    if (data === "deleted") deleted++;
    else deactivated++;
  }

  revalidatePath("/products");

  if (errors.length > 0 && deleted === 0 && deactivated === 0) {
    return { error: errors[0] };
  }
  return { ok: true, deleted, deactivated };
}

export type BulkMoveStockState =
  | { error: string }
  | { ok: true; moved: number; errors: number }
  | undefined;

/**
 * Moves stock for several variants from one location to another in a single
 * action — one record_stock_transfer call per variant (each already atomic:
 * TRANSFER_OUT + TRANSFER_IN in one transaction — see 0002_*.sql), all
 * sharing one reference_id so the whole batch move can be traced as a unit
 * later via that reference_id, the same way a purchase order's lines share
 * one PO reference.
 */
export async function bulkMoveStock(
  _prevState: BulkMoveStockState,
  formData: FormData
): Promise<BulkMoveStockState> {
  const sourceLocationId = String(formData.get("sourceLocationId") ?? "");
  const destinationLocationId = String(formData.get("destinationLocationId") ?? "");

  if (!sourceLocationId || !destinationLocationId) {
    return { error: "Choose a source and a destination location." };
  }
  if (sourceLocationId === destinationLocationId) {
    return { error: "Source and destination must be different." };
  }

  let variantIds: unknown;
  try {
    variantIds = JSON.parse(String(formData.get("variantIds") ?? "[]"));
  } catch {
    return { error: "Malformed selection." };
  }
  if (!Array.isArray(variantIds) || variantIds.length === 0) {
    return { error: "No variants selected." };
  }

  const lines = variantIds
    .filter((id): id is string => typeof id === "string")
    .map((variantId) => ({
      variantId,
      quantity: Number(formData.get(`quantity-${variantId}`) ?? 0),
    }))
    .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);

  if (lines.length === 0) {
    return { error: "Enter a quantity for at least one item." };
  }

  const supabase = await createClient();
  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const referenceId = randomUUID();
  let moved = 0;
  let errorCount = 0;

  for (const line of lines) {
    const { error } = await supabase.rpc("record_stock_transfer", {
      p_organisation_id: organisationId,
      p_source_location_id: sourceLocationId,
      p_destination_location_id: destinationLocationId,
      p_product_variant_id: line.variantId,
      p_quantity: line.quantity,
      p_reference_id: referenceId,
    });
    if (error) errorCount++;
    else moved++;
  }

  revalidatePath("/products");
  revalidatePath("/movements");
  revalidatePath("/transfers");

  if (moved === 0) {
    return { error: "Could not move any of the selected stock." };
  }
  return { ok: true, moved, errors: errorCount };
}
