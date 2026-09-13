import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { loadProducts } from "@/app/(app)/products/data";
import { ProductEditPageContent } from "@/components/products/product-edit-page-content";

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { id } = await params;

  const [products, locationsRes] = await Promise.all([
    loadProducts(supabase, { id }),
    supabase.from("locations").select("id, name").order("name"),
  ]);

  if (locationsRes.error) {
    throw locationsRes.error;
  }

  const product = products[0];
  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6 md:p-10">
      <ProductEditPageContent
        product={product}
        locations={locationsRes.data ?? []}
      />
    </div>
  );
}
