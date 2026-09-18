"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ProductEditContent } from "@/components/products/product-edit-content";
import type { EditableProduct } from "@/components/products/products-table";
import type { LocationOption } from "@/components/products/variant-extra-fields";
import type { Currency } from "@/app/(app)/products/constants";
import type { PriceSettingsRates } from "@/lib/price-calculation";

/**
 * The mobile-width full-page equivalent of ProductEditPanel — same fields,
 * same ProductEditContent, just page chrome instead of a persistent side
 * panel.
 */
export function ProductEditPageContent({
  product,
  locations,
  defaultCurrency,
  priceSettings,
}: {
  product: EditableProduct;
  locations: LocationOption[];
  defaultCurrency: Currency;
  priceSettings: PriceSettingsRates | null;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/products"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Products
      </Link>

      <div>
        <h1 className="text-page-title">{product.name}</h1>
        <p className="text-page-subtitle">
          Product details, pricing, and variants.
        </p>
      </div>

      <ProductEditContent
        key={product.id}
        product={product}
        locations={locations}
        defaultCurrency={defaultCurrency}
        priceSettings={priceSettings}
        onDeleted={() => router.push("/products")}
      />
    </div>
  );
}
