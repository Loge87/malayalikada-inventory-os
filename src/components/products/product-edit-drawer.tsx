"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProductEditContent } from "@/components/products/product-edit-content";
import type { EditableProduct } from "@/components/products/products-table";
import type { LocationOption } from "@/components/products/variant-extra-fields";

/**
 * Desktop-width edit surface: a right-side panel. (Mobile-width uses a
 * dedicated full page instead — /products/[id]/edit — since a side panel
 * doesn't make sense on a narrow screen; ProductsTable decides which one to
 * open, using the same breakpoint as the nav.)
 */
export function ProductEditDrawer({
  product,
  open,
  onOpenChange,
  locations,
}: {
  product: EditableProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: LocationOption[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-lg"
      >
        {product ? (
          <div className="flex flex-col gap-4 p-4">
            <SheetHeader className="p-0">
              <SheetTitle>{product.name}</SheetTitle>
              <SheetDescription>
                Product details, pricing, and variants.
              </SheetDescription>
            </SheetHeader>

            <ProductEditContent
              key={product.id}
              product={product}
              locations={locations}
              onDeleted={() => onOpenChange(false)}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
