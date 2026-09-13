import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { NewProductForm } from "@/components/products/new-product-form";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string; returnTo?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const params = await searchParams;
  const barcode = (params.barcode ?? "").trim();
  // Explicit, not inferred from whether a barcode is present — a barcode can
  // arrive either from /scan's not-found screen (should return to /scan) or
  // from /products' own "Scan barcode" menu item (should return to /products).
  const returnTo = params.returnTo === "/scan" ? "/scan" : "/products";

  const { data: locations, error } = await supabase
    .from("locations")
    .select("id, name")
    .order("name");

  if (error) {
    throw error;
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 p-6 md:p-10">
      <div>
        <h1 className="font-heading text-xl font-medium">Add product</h1>
        {barcode ? (
          <p className="text-muted-foreground text-sm">
            For scanned barcode{" "}
            <span className="font-mono text-foreground">{barcode}</span>
          </p>
        ) : null}
      </div>

      <NewProductForm
        barcode={barcode}
        locations={locations ?? []}
        returnTo={returnTo}
      />

      <Link
        href={returnTo}
        className="text-muted-foreground text-center text-sm underline"
      >
        {returnTo === "/scan" ? "Back to scan" : "Back to products"}
      </Link>
    </div>
  );
}
