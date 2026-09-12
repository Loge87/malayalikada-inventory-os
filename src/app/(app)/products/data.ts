import type { SupabaseClient } from "@supabase/supabase-js";

import { PRODUCT_IMAGE_BUCKET } from "@/app/(app)/products/constants";
import type { EditableProduct } from "@/components/products/products-table";

type VariantRow = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  currency: string;
  pack_price: number | null;
  units_per_pack: number;
  unit_price: number | null;
  inventory_levels: { on_hand: number }[];
};

type ProductRow = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  image_url: string | null;
  is_active: boolean;
  product_variants: VariantRow[];
};

const PRODUCT_SELECT = `id, name, category, brand, image_url, is_active,
  product_variants(
    id, name, sku, barcode, unit,
    currency, pack_price, units_per_pack, unit_price,
    inventory_levels(on_hand)
  )`;

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — regenerated on every load

/**
 * Fetches products (all, or one by id) with their variants and stock, and
 * resolves each product's image to a short-lived signed URL. Shared by the
 * /products list and the single-product edit views (drawer + mobile full
 * page) so both compute the exact same shape.
 */
export async function loadProducts(
  supabase: SupabaseClient,
  options: { id?: string } = {}
): Promise<EditableProduct[]> {
  let query = supabase.from("products").select(PRODUCT_SELECT).order("name");
  if (options.id) {
    query = query.eq("id", options.id);
  }

  const { data, error } = await query.returns<ProductRow[]>();
  if (error) {
    throw error;
  }
  const productRows = data ?? [];

  // Private bucket — resolve every product's stored path to a signed URL in
  // one call. A product with no image, or one whose signing fails for any
  // reason, just falls back to the placeholder icon.
  const imagePaths = [
    ...new Set(
      productRows
        .map((p) => p.image_url)
        .filter((path): path is string => Boolean(path))
    ),
  ];
  const signedUrlByPath = new Map<string, string>();
  if (imagePaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .createSignedUrls(imagePaths, SIGNED_URL_TTL_SECONDS);
    for (const entry of signedUrls ?? []) {
      if (entry.signedUrl && !entry.error) {
        signedUrlByPath.set(entry.path ?? "", entry.signedUrl);
      }
    }
  }

  return productRows.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    brand: product.brand,
    imageUrl: product.image_url
      ? (signedUrlByPath.get(product.image_url) ?? null)
      : null,
    isActive: product.is_active,
    variants: product.product_variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      unit: variant.unit,
      currency: variant.currency,
      packPrice: variant.pack_price,
      unitsPerPack: variant.units_per_pack,
      unitPrice: variant.unit_price,
      onHand: variant.inventory_levels.reduce((sum, l) => sum + l.on_hand, 0),
    })),
  }));
}
