import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PRODUCT_IMAGE_BUCKET } from "@/app/(app)/products/constants";
import {
  ProductsTable,
  type EditableProduct,
} from "@/components/products/products-table";
import type { LocationOption } from "@/components/products/variant-extra-fields";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  product_variants: VariantRow[];
};

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — regenerated on every page load

export default async function ProductsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS scopes reads to the caller's organisation.
  const [productsRes, locationsRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        `id, name, category, brand, image_url,
         product_variants(
           id, name, sku, barcode, unit,
           currency, pack_price, units_per_pack, unit_price,
           inventory_levels(on_hand)
         )`
      )
      .order("name")
      .returns<ProductRow[]>(),
    supabase.from("locations").select("id, name").order("name"),
  ]);

  const firstError = productsRes.error || locationsRes.error;
  if (firstError) {
    throw firstError;
  }

  const productRows = productsRes.data ?? [];
  const locations: LocationOption[] = locationsRes.data ?? [];

  // Private bucket — resolve every product's stored path to a short-lived
  // signed URL in one call. Products without an image, or whose signing fails
  // for any reason, just fall back to the placeholder icon in the table.
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

  const products: EditableProduct[] = productRows.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    brand: product.brand,
    imageUrl: product.image_url
      ? (signedUrlByPath.get(product.image_url) ?? null)
      : null,
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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 md:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-medium">Products</h1>
          <p className="text-muted-foreground text-sm">
            {products.length > 0
              ? `${products.length} product${products.length === 1 ? "" : "s"}`
              : "No products yet"}
          </p>
        </div>
        <Link href="/products/new" className={buttonVariants({ size: "sm" })}>
          Add product
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>
            Click Edit to change details, pricing, image, or variants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {products.length > 0 ? (
            <ProductsTable products={products} locations={locations} />
          ) : (
            <p className="text-muted-foreground">No products yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
