import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AddProductFlow } from "@/components/products/add-product-flow";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const barcode = ((await searchParams).barcode ?? "").trim();

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

      <AddProductFlow initialBarcode={barcode} locations={locations ?? []} />

      <Link
        href={barcode ? "/scan" : "/products"}
        className="text-muted-foreground text-center text-sm underline"
      >
        {barcode ? "Back to scan" : "Back to products"}
      </Link>
    </div>
  );
}
