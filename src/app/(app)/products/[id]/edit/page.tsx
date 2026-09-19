import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import {
  getCurrentOrganisationId,
  getOrganisationDefaultCurrency,
  getOrganisationPriceSettings,
} from "@/lib/organisation";
import { DEFAULT_CURRENCY } from "@/app/(app)/products/constants";
import { loadProducts } from "@/app/(app)/products/data";
import { ProductEditPageContent } from "@/components/products/product-edit-page-content";
import { ProductCreatedToast } from "@/components/products/product-created-toast";

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

  const [products, locationsRes, organisationId] = await Promise.all([
    loadProducts(supabase, { id }),
    supabase
      .from("locations")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    getCurrentOrganisationId(supabase),
  ]);

  if (locationsRes.error) {
    throw locationsRes.error;
  }

  const product = products[0];
  if (!product) {
    notFound();
  }

  const [defaultCurrency, priceSettings] = await Promise.all([
    organisationId
      ? getOrganisationDefaultCurrency(supabase, organisationId)
      : Promise.resolve(DEFAULT_CURRENCY),
    organisationId
      ? getOrganisationPriceSettings(supabase, organisationId)
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <ProductEditPageContent
        product={product}
        locations={locationsRes.data ?? []}
        defaultCurrency={defaultCurrency}
        priceSettings={priceSettings}
      />
      <ProductCreatedToast />
    </div>
  );
}
