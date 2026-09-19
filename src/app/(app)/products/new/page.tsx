import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import {
  getCurrentOrganisationId,
  getOrganisationDefaultCurrency,
} from "@/lib/organisation";
import { DEFAULT_CURRENCY } from "@/app/(app)/products/constants";
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

  const [{ data: locations, error }, organisationId] = await Promise.all([
    supabase
      .from("locations")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    getCurrentOrganisationId(supabase),
  ]);

  if (error) {
    throw error;
  }

  const defaultCurrency = organisationId
    ? await getOrganisationDefaultCurrency(supabase, organisationId)
    : DEFAULT_CURRENCY;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Add product</h1>
        {barcode ? (
          <p className="text-page-subtitle">
            For scanned barcode{" "}
            <span className="font-mono text-foreground">{barcode}</span>
          </p>
        ) : null}
      </div>

      <NewProductForm
        barcode={barcode}
        locations={locations ?? []}
        defaultCurrency={defaultCurrency}
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
