import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { loadProducts } from "@/app/(app)/products/data";
import { AddProductMenu } from "@/components/products/add-product-menu";
import { ProductsTable } from "@/components/products/products-table";
import type { LocationOption } from "@/components/products/variant-extra-fields";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ProductsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // RLS scopes reads to the caller's organisation.
  const [products, locationsRes] = await Promise.all([
    loadProducts(supabase),
    supabase.from("locations").select("id, name").order("name"),
  ]);

  if (locationsRes.error) {
    throw locationsRes.error;
  }

  const locations: LocationOption[] = locationsRes.data ?? [];

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
        <AddProductMenu />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>
            Click a row or Edit to change details, pricing, image, or
            variants.
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
