import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { NewProductForm } from "@/components/products/new-product-form";

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

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 p-6 md:p-10">
      <div>
        <h1 className="font-heading text-xl font-medium">New product</h1>
        <p className="text-muted-foreground text-sm">
          {barcode ? (
            <>
              For scanned barcode{" "}
              <span className="font-mono text-foreground">{barcode}</span>
            </>
          ) : (
            "Add a product and its first variant"
          )}
        </p>
      </div>

      <NewProductForm barcode={barcode} />

      <Link
        href="/scan"
        className="text-muted-foreground text-center text-sm underline"
      >
        Back to scan
      </Link>
    </div>
  );
}
