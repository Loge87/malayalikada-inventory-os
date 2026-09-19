import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import {
  getCurrentOrganisationId,
  getOrganisationDefaultCurrency,
  getOrganisationPriceSettings,
} from "@/lib/organisation";
import { DEFAULT_CURRENCY } from "@/app/(app)/products/constants";
import { loadProducts } from "@/app/(app)/products/data";
import { AddProductMenu } from "@/components/products/add-product-menu";
import { ProductCreatedToast } from "@/components/products/product-created-toast";
import { ProductsPageContent } from "@/components/products/products-page-content";
import type { LocationOption } from "@/components/products/variant-extra-fields";
import type { StockStatus } from "@/lib/stock-status";

const VALID_STATUS_FILTERS: StockStatus[] = [
  "in_stock",
  "low_stock",
  "out_of_stock",
  "inactive",
];

export default async function ProductsPage({
  searchParams,
}: {
  // ?status=<...> arrives from the dashboard's stat cards. ?location=<id>
  // arrives either the same way (the dashboard's stock-by-location chart/
  // table) or from this page's own location filter dropdown (ProductsTable)
  // — either way it's a real URL, so the filtered view survives a refresh
  // and can be bookmarked/shared.
  searchParams: Promise<{ status?: string; location?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { status, location } = await searchParams;
  const initialStatusFilter = VALID_STATUS_FILTERS.includes(status as StockStatus)
    ? (status as StockStatus)
    : null;

  const supabase = await createClient();

  // RLS scopes reads to the caller's organisation.
  const [productsResult, locationsRes, organisationId] = await Promise.all([
    loadProducts(supabase),
    supabase.from("locations").select("id, name").order("name"),
    getCurrentOrganisationId(supabase),
  ]);

  if (locationsRes.error) {
    throw locationsRes.error;
  }

  const locations: LocationOption[] = locationsRes.data ?? [];
  const [defaultCurrency, priceSettings] = await Promise.all([
    organisationId
      ? getOrganisationDefaultCurrency(supabase, organisationId)
      : Promise.resolve(DEFAULT_CURRENCY),
    organisationId
      ? getOrganisationPriceSettings(supabase, organisationId)
      : Promise.resolve(null),
  ]);

  // Re-scope to one location's actual stock, not the cross-location
  // aggregate loadProducts() normally returns — each variant's onHand is
  // overridden to that location's own on_hand, and variants never stocked
  // there (or stocked at exactly 0) are dropped, so this reads as "what's
  // actually stocked at this location," matching what the dashboard's
  // chart/table and the new location filter dropdown both mean by it.
  let products = productsResult;
  let locationFilterName: string | null = null;
  if (location) {
    const matchedLocation = locations.find((l) => l.id === location);
    if (matchedLocation) {
      locationFilterName = matchedLocation.name;
      const { data: levelsAtLocation, error: levelsError } = await supabase
        .from("inventory_levels")
        .select("product_variant_id, on_hand")
        .eq("location_id", location)
        .gt("on_hand", 0);
      if (levelsError) {
        throw levelsError;
      }
      const onHandByVariant = new Map(
        (levelsAtLocation ?? []).map((l) => [l.product_variant_id, l.on_hand])
      );
      products = productsResult
        .map((product) => ({
          ...product,
          variants: product.variants
            .filter((variant) => onHandByVariant.has(variant.id))
            .map((variant) => ({
              ...variant,
              onHand: onHandByVariant.get(variant.id)!,
            })),
        }))
        .filter((product) => product.variants.length > 0);
    }
  }

  const activeProductCount = products.filter((p) => p.isActive).length;

  return (
    <div className="flex w-full flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title">
            {locationFilterName ? `Products — ${locationFilterName}` : "Products"}
          </h1>
          <p className="text-page-subtitle">
            {/* Active only — matches ProductsTable's default view, which
                excludes deactivated (soft-deleted) products the same way. */}
            {activeProductCount > 0
              ? `${activeProductCount} product${activeProductCount === 1 ? "" : "s"}`
              : "No products yet"}
          </p>
        </div>
        <AddProductMenu />
      </div>

      <ProductsPageContent
        products={products}
        locations={locations}
        defaultCurrency={defaultCurrency}
        priceSettings={priceSettings}
        initialStatusFilter={initialStatusFilter}
        selectedLocationId={location ?? null}
        emptyMessage={location ? "No stock at this location" : "No products yet"}
      />
      <ProductCreatedToast />
    </div>
  );
}
