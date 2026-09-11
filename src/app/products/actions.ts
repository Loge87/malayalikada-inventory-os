"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import {
  VARIANT_UNITS,
  type ProductFormState,
  type VariantUnit,
} from "@/app/products/constants";

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

  const supabase = await createClient();

  const organisationId = await getCurrentOrganisationId(supabase);

  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  // RLS also checks that `product_id` belongs to the caller's org.
  const { error } = await supabase.from("product_variants").insert({
    product_id: productId,
    name,
    sku,
    barcode: barcode || null,
    unit,
    organisation_id: organisationId,
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

  const supabase = await createClient();

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({ organisation_id: organisationId, name: productName, category })
    .select("id")
    .single();

  if (productError || !product) {
    return {
      error: productError?.message ?? "Could not create the product.",
    };
  }

  const { error: variantError } = await supabase.from("product_variants").insert({
    organisation_id: organisationId,
    product_id: product.id,
    name: variantName,
    sku,
    barcode: barcode || null,
    unit,
  });

  if (variantError) {
    // Roll back the header so we don't leave a product with no variant.
    await supabase.from("products").delete().eq("id", product.id);
    return { error: variantError.message };
  }

  revalidatePath("/products");
  revalidatePath("/scan");
  redirect("/scan");
}
