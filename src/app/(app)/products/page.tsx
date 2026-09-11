import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/products/product-form";
import { VariantForm } from "@/components/products/variant-form";
import type { LocationOption } from "@/components/products/variant-extra-fields";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Variant = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
};

type Product = {
  id: string;
  name: string;
  category: string;
  product_variants: Variant[];
};

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
        "id, name, category, product_variants(id, name, sku, barcode, unit)"
      )
      .order("name")
      .returns<Product[]>(),
    supabase.from("locations").select("id, name").order("name"),
  ]);

  const firstError = productsRes.error || locationsRes.error;
  if (firstError) {
    throw firstError;
  }

  const products = productsRes.data;
  const locations: LocationOption[] = locationsRes.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 md:p-10">
      <ProductForm />

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            {products && products.length > 0
              ? `${products.length} product${products.length === 1 ? "" : "s"}`
              : "None yet"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {products && products.length > 0 ? (
            products.map((product) => (
              <div key={product.id} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{product.name}</span>
                  <span className="text-muted-foreground">
                    {product.category}
                  </span>
                </div>

                {product.product_variants.length > 0 ? (
                  <ul className="divide-y divide-border rounded-lg ring-1 ring-foreground/10">
                    {product.product_variants.map((variant) => (
                      <li key={variant.id} className="flex flex-col gap-0.5 p-2.5">
                        <div className="flex items-center justify-between">
                          <span>{variant.name}</span>
                          <span className="text-muted-foreground">
                            {variant.unit}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          SKU {variant.sku}
                          {variant.barcode ? ` · ${variant.barcode}` : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">No variants yet</p>
                )}

                <VariantForm productId={product.id} locations={locations} />
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No products yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
