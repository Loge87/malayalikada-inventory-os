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
import type { PricingContext } from "@/lib/price-formula";

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
  pricing,
  onClose,
}: {
  product: EditableProduct;
  locations: LocationOption[];
  defaultCurrency: Currency;
  pricing: PricingContext;
  onClose: () => void;
}) {
  return (
    <Card
      elevated
      // `.side-panel` (ui.css) sets overflow-y: auto, but ui.css loads into
      // Tailwind's "components" layer (globals.css) — strictly LOWER
      // priority than Tailwind's own "utilities" layer, so it can never
      // override the base Card component's own `overflow-hidden` utility
      // (ui/card.tsx). That made this panel silently uncappable-scroll
      // (clipped, not scrollable) the moment its content ever grew past
      // max-h-[calc(100vh-3rem)] — which it only recently started doing
      // (Price Formula's calculated-price block, charm pricing, etc.).
      // `overflow-y-auto` here is a genuine Tailwind utility, same layer as
      // overflow-hidden, so it wins on the merits (Tailwind orders the
      // longhand overflow-x/-y utilities after the overflow shorthand) —
      // kept `.side-panel` for its documentation value, but the actual
      // scroll behavior no longer depends on it.
      className="side-panel sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto animate-in fade-in slide-in-from-right-4 scrollbar-hover-thin duration-300"
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
          pricing={pricing}
          onDeleted={onClose}
        />
      </CardContent>
    </Card>
  );
}
