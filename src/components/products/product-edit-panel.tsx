"use client";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductEditContent } from "@/components/products/product-edit-content";
import type { EditableProduct } from "@/components/products/products-table";
import type { LocationOption } from "@/components/products/variant-extra-fields";
import type { Currency } from "@/app/(app)/products/constants";
import type { PriceSettingsRates } from "@/lib/price-calculation";

/**
 * Desktop-width edit surface: a persistent panel that's part of the page's
 * own layout (ProductsPageContent's flex row), not an overlay — the product
 * list narrows to make room for it rather than being covered. Sticky so it
 * stays in view while a long list scrolls past it.
 *
 * Mobile uses a dedicated full page instead (product-edit-page-content.tsx)
 * — ProductsTable's openEdit() decides which one applies, using the same
 * breakpoint as the nav, so this component is only ever mounted on desktop.
 */
export function ProductEditPanel({
  product,
  locations,
  defaultCurrency,
  priceSettings,
  onClose,
}: {
  product: EditableProduct;
  locations: LocationOption[];
  defaultCurrency: Currency;
  priceSettings: PriceSettingsRates | null;
  onClose: () => void;
}) {
  return (
    <Card
      elevated
      className="sticky top-6 max-h-[calc(100vh-3rem)] animate-in overflow-y-auto fade-in slide-in-from-right-4 scrollbar-hover-thin duration-300"
    >
      {/* Absolutely positioned against the panel's own corner (the same
          top-3 right-3 convention Dialog/Sheet's close button already
          uses), not inline in the header's flex row — so it stays pinned
          to the panel's actual top-right edge regardless of how tall the
          title/description block gets. */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        aria-label="Close panel"
        className="absolute top-3 right-3"
      >
        <XIcon className="size-4" />
      </Button>
      <CardHeader className="pr-12">
        <CardTitle className="truncate">{product.name}</CardTitle>
        <CardDescription>
          Product details, pricing, and variants.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProductEditContent
          key={product.id}
          product={product}
          locations={locations}
          defaultCurrency={defaultCurrency}
          priceSettings={priceSettings}
          onDeleted={onClose}
        />
      </CardContent>
    </Card>
  );
}
