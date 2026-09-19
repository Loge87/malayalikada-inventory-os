"use client";

import { useState } from "react";

import { useIsWideDesktop } from "@/lib/use-media-query";
import type { StockStatus } from "@/lib/stock-status";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ProductsTable,
  type EditableProduct,
} from "@/components/products/products-table";
import { ProductEditPanel } from "@/components/products/product-edit-panel";
import type { LocationOption } from "@/components/products/variant-extra-fields";
import type { Currency } from "@/app/(app)/products/constants";
import type { OrganisationPriceSettings } from "@/lib/organisation";

/**
 * Owns the one piece of state ProductsTable and the edit panel both need to
 * share: which product (if any) is open. At lg (1024px) and up, that renders
 * ProductEditPanel as a second column — the list narrows to make room
 * rather than being covered by an overlay. Below that (including tablet
 * widths, which don't have room for both a usable list and a usable panel),
 * ProductsTable's own openEdit() routes to the full-page edit route
 * instead, so a selection here is never made (selectedProduct is
 * deliberately gated on isWideDesktop too, as a safeguard if the panel is
 * open and the window narrows past 1024px).
 */
export function ProductsPageContent({
  products,
  locations,
  defaultCurrency,
  priceSettings,
  initialStatusFilter,
  selectedLocationId,
  emptyMessage,
}: {
  products: EditableProduct[];
  locations: LocationOption[];
  defaultCurrency: Currency;
  priceSettings: OrganisationPriceSettings | null;
  initialStatusFilter: StockStatus | null;
  /** From /products?location=<id> — already applied server-side to
   *  `products` (page.tsx); passed through so ProductsTable's location
   *  dropdown shows the right value, and so it can key off this to reset
   *  its own filters/pagination when the location changes. */
  selectedLocationId: string | null;
  emptyMessage: string;
}) {
  const isWideDesktop = useIsWideDesktop();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );
  const selectedProduct = isWideDesktop
    ? (products.find((p) => p.id === selectedProductId) ?? null)
    : null;

  return (
    <div className="flex items-start gap-6">
      <div className="min-w-0 flex-1">
        <Card elevated>
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
            <CardDescription>
              Click a row or Edit to change details, pricing, image, or
              variants.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {products.length > 0 ? (
              <ProductsTable
                // Remounts on a location change — a fresh instance means
                // search/status/category filters and pagination all reset
                // cleanly to their defaults rather than carrying over
                // whatever they happened to be for the previous location,
                // and totalPages/page recompute from scratch against the
                // new (already server-filtered) `products` set.
                key={selectedLocationId ?? "all-locations"}
                products={products}
                locations={locations}
                priceSettings={priceSettings}
                initialStatusFilter={initialStatusFilter}
                selectedLocationId={selectedLocationId}
                selectedProductId={selectedProduct?.id ?? null}
                onSelectProduct={setSelectedProductId}
              />
            ) : (
              <p className="text-muted-foreground">{emptyMessage}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedProduct ? (
        <div className="w-[400px] shrink-0 xl:w-[440px]">
          <ProductEditPanel
            product={selectedProduct}
            locations={locations}
            defaultCurrency={defaultCurrency}
            priceSettings={priceSettings}
            onClose={() => setSelectedProductId(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
