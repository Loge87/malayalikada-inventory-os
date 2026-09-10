"use server";

import { revalidatePath } from "next/cache";

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
