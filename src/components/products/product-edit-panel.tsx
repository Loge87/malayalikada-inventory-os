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
      // CORRECTED: this used to be one single scroll container — the
      // whole card (title/close button included) scrolled as one unit,
      // so the header scrolled out of view along with the form on a long
      // product. Now only CardContent below scrolls; this outer element
      // stays a fixed-height flex column (Card's own base class already
      // supplies flex flex-col overflow-hidden — see ui/card.tsx) so the
      // header stays pinned and the rounded corners stay genuinely
      // rounded (a scrolling element's own corner can get a square-edged
      // "flash" at the scroll boundary in some browsers; a non-scrolling
      // outer frame avoids that entirely).
      //
      // h-[97dvh] + top-[1.5dvh]: a fixed height (not max-height — sticky
      // positioning with "bottom edge always on-screen" needs a KNOWN
      // height to position against, not a cap that only sometimes
      // applies), dvh instead of vh so a mobile browser's address-bar
      // show/hide doesn't leave a few pixels of the panel's own bottom
      // edge off-screen the way vh's "largest possible viewport" can.
      // relative, explicitly — the close button below needs a positioned
      // ancestor to pin against.
      className="side-panel relative sticky top-[1.5dvh] flex h-[97dvh] flex-col animate-in fade-in slide-in-from-right-4 duration-(--duration-base)"
    >
      {/* Absolutely positioned against the panel's own corner (the same
          top-3 right-3 convention Dialog/Sheet's close button already
          uses), not inline in the header's flex row — so it stays pinned
          to the panel's actual top-right edge regardless of how tall the
          title/description block gets. shrink-0 alongside it on the
          header below keeps both out of the flex-sizing calculation that
          only CardContent (flex-1) should participate in. */}
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
      <CardHeader className="shrink-0 pr-12">
        <CardTitle className="truncate">{product.name}</CardTitle>
        <CardDescription>
          Product details, pricing, and variants.
        </CardDescription>
      </CardHeader>
      {/* The actual scroll container — flex-1 to claim the remaining
          height after the header's own; min-h-0 is the part that's easy
          to miss (a flex child's default min-height is `auto`, which
          means "at least as tall as my content," not 0 — without this,
          the flex item refuses to shrink below its content's natural
          height at all, so it just grows the whole panel/page instead of
          ever actually scrolling internally). pb-10, inside the scroll
          region, is deliberate too: the LAST field/button needs real
          clearance from the panel's own bottom edge, not just from
          whatever's rendered after it — padding on a later, uncrossed
          sibling wouldn't help once that sibling is the thing being
          scrolled past. */}
      <CardContent className="min-h-0 flex-1 overflow-y-auto scrollbar-hover-thin pb-10">
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
