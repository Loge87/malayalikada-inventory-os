"use client";

import { useActionState } from "react";

import { createProductWithVariant } from "@/app/(app)/products/actions";
import { VARIANT_UNITS } from "@/app/(app)/products/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductImageField } from "@/components/products/product-image-field";
import { useVariantPricingFields } from "@/components/products/variant-pricing-fields";
import type { LocationOption } from "@/components/products/variant-extra-fields";
import type { Currency } from "@/app/(app)/products/constants";

const UNIT_ITEMS: Record<string, string> = Object.fromEntries(
  VARIANT_UNITS.map((unit) => [unit, unit])
);

export function NewProductForm({
  barcode,
  locations,
  defaultCurrency,
  returnTo = "/products",
}: {
  barcode: string;
  locations: LocationOption[];
  /** The organisation's configured default currency (organisations.
   *  default_currency) — pre-fills this NEW variant's currency select.
   *  Doesn't affect any existing variant. */
  defaultCurrency: Currency;
  /** Where to land after a successful create — "/scan" for the scan-originated
   *  flow (so the barcode can be re-scanned), otherwise "/products". */
  returnTo?: "/scan" | "/products";
}) {
  const [state, formAction, pending] = useActionState(
    createProductWithVariant,
    undefined
  );

  // Pulled out of the default VariantPricingFields arrangement so this form
  // can pair currency with unit and unit price with initial quantity — its
  // own 2-column grouping, rather than the pricing-only pairing the edit
  // drawer and "add variant" form use.
  const { currencyField, packPriceField, unitsPerPackField, unitPriceField } =
    useVariantPricingFields({ idPrefix: "new-product", defaultCurrency });

  const locationItems: Record<string, string> = Object.fromEntries(
    locations.map((l) => [l.id, l.name])
  );

  return (
    <Card elevated>
      <CardHeader>
        <CardTitle>New product</CardTitle>
        <CardDescription>
          {barcode
            ? "Enter the product and variant details for the scanned barcode."
            : "Add a product and its first variant."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* On success the action redirects, so no reset handling. Every
            related pair below is a responsive Field — side by side once
            this card has room (its own container width, not the viewport),
            stacked full-width otherwise; see ui/field.tsx. */}
        <form action={formAction}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <FieldGroup>
            <span className="text-xs font-medium text-muted-foreground">
              Product
            </span>
            <ProductImageField idPrefix="new-product" />
            <Field orientation="responsive">
              <Field>
                <FieldLabel htmlFor="productName">Product name</FieldLabel>
                <Input
                  id="productName"
                  name="productName"
                  placeholder="Basmati Rice"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="category">Category</FieldLabel>
                <Input
                  id="category"
                  name="category"
                  placeholder="Grains"
                  required
                />
              </Field>
            </Field>
            <Field>
              <FieldLabel htmlFor="brand">Brand</FieldLabel>
              <Input id="brand" name="brand" placeholder="Optional" />
            </Field>

            <span className="text-xs font-medium text-muted-foreground">
              First variant
            </span>
            <Field>
              <FieldLabel htmlFor="variantName">Variant</FieldLabel>
              <Input
                id="variantName"
                name="variantName"
                placeholder="5kg bag"
                required
              />
            </Field>
            <Field orientation="responsive">
              <Field>
                <FieldLabel htmlFor="sku">SKU</FieldLabel>
                <Input id="sku" name="sku" placeholder="RICE-BAS-5KG" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="barcode">Barcode</FieldLabel>
                <Input
                  id="barcode"
                  name="barcode"
                  defaultValue={barcode}
                  placeholder="Optional"
                  className={barcode ? "font-mono" : undefined}
                />
                {barcode ? (
                  <FieldDescription>
                    Pre-filled from the scan — edit if it was misread.
                  </FieldDescription>
                ) : null}
              </Field>
            </Field>

            {/* Pricing and initial stock share one section — unit price
                pairs with initial quantity below, so a single header
                covering both reads more naturally than splitting them.
                Unit price comes first: it's the field you fill in directly,
                and pack/case price (below) is calculated from it × units
                per pack/case/box, though still editable if a supplier
                quotes a case price that doesn't cleanly multiply out. */}
            <span className="text-xs font-medium text-muted-foreground">
              Pricing &amp; initial stock (optional)
            </span>
            <Field orientation="responsive">
              {currencyField}
              <Field>
                <FieldLabel htmlFor="unit">Unit</FieldLabel>
                <Select name="unit" defaultValue="each" items={UNIT_ITEMS}>
                  <SelectTrigger id="unit" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIANT_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </Field>
            <Field orientation="responsive">
              {unitPriceField}
              <Field>
                <FieldLabel htmlFor="new-product-initialQuantity">
                  Quantity
                </FieldLabel>
                <Input
                  id="new-product-initialQuantity"
                  name="initialQuantity"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Optional"
                />
                <FieldDescription>
                  Recorded as a received-stock ledger movement, not set
                  directly.
                </FieldDescription>
              </Field>
            </Field>
            <Field orientation="responsive">
              {unitsPerPackField}
              {packPriceField}
            </Field>

            <Field>
              <FieldLabel htmlFor="new-product-initialLocationId">
                Location
              </FieldLabel>
              <Select name="initialLocationId" items={locationItems}>
                <SelectTrigger
                  id="new-product-initialLocationId"
                  className="w-full"
                >
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {state && "error" in state ? (
              <FieldError>{state.error}</FieldError>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating…" : "Create product"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
