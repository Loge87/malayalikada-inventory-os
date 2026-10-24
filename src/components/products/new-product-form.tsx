"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createProductWithVariant } from "@/app/(app)/products/actions";
import { VARIANT_UNITS } from "@/app/(app)/products/constants";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { BarcodeDuplicateField } from "@/components/products/barcode-duplicate-field";
import { ProductImageField } from "@/components/products/product-image-field";
import { ReactivateProductButton } from "@/components/products/reactivate-product-button";
import {
  ReadOnlyCurrencyField,
  useVariantPricingFields,
} from "@/components/products/variant-pricing-fields";
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
  /** The organisation's current Price Settings currency (organisations.
   *  default_currency) — this NEW variant's currency is always set to
   *  this, server-side (products/actions.ts), no per-variant override.
   *  Shown here read-only, after the price fields. */
  defaultCurrency: Currency;
  /** Where to land after a successful create — "/scan" for the scan-originated
   *  flow (so the barcode can be re-scanned), otherwise "/products". */
  returnTo?: "/scan" | "/products";
}) {
  const [state, formAction, pending] = useActionState(
    createProductWithVariant,
    undefined
  );
  const [barcodeDuplicate, setBarcodeDuplicate] = useState<
    { productId: string; productName: string } | null
  >(null);

  // Pulled out of the default VariantPricingFields arrangement so this form
  // can pair unit price with initial quantity — its own 2-column grouping,
  // rather than the pricing-only pairing the edit drawer and "add variant"
  // form use.
  const { packPriceField, unitsPerPackField, unitPriceField } =
    useVariantPricingFields({ idPrefix: "new-product" });

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
            related group below is a .form-grid row (item 5) — a real CSS
            grid, not the flex-based Field orientation="responsive" pairing
            this form used before: that wrapper's items-center is what let
            the barcode-duplicate warning (BarcodeDuplicateField) re-center
            the whole SKU/Barcode row and knock the SKU input out of
            alignment once it appeared. align-items: start on .form-grid
            (ui.css) means a field growing taller than its row-mates now
            only pushes what comes AFTER the row down, never shifts the
            row's own tops relative to each other. */}
        <form action={formAction}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <FieldGroup>
            <span className="text-xs font-medium text-muted-foreground">
              Product
            </span>
            <ProductImageField idPrefix="new-product" />
            <div className="form-grid form-grid-cols-2">
              <Field>
                <FieldLabel htmlFor="productName">Product name</FieldLabel>
                <Input
                  id="productName"
                  name="productName"
                  placeholder="Basmati Rice"
                  required
                />
                <div className="field-message-slot" />
              </Field>
              <Field>
                <FieldLabel htmlFor="category">Category</FieldLabel>
                <Input
                  id="category"
                  name="category"
                  placeholder="Grains"
                  required
                />
                <div className="field-message-slot" />
              </Field>
            </div>
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
            <div className="form-grid form-grid-cols-2">
              <Field>
                <FieldLabel htmlFor="sku">SKU</FieldLabel>
                <Input id="sku" name="sku" placeholder="RICE-BAS-5KG" required />
                <div className="field-message-slot" />
              </Field>
              <div>
                <BarcodeDuplicateField
                  id="barcode"
                  defaultValue={barcode}
                  onDuplicateChange={setBarcodeDuplicate}
                />
                {barcode ? (
                  <FieldDescription>
                    Pre-filled from the scan — edit if it was misread.
                  </FieldDescription>
                ) : null}
              </div>
            </div>

            {/* Pricing and initial stock share one section. Unit pairs
                with initial quantity (both are "how this variant is
                counted/received," not pricing per se); unit price, units
                per pack, and pack price then share their own 3-up row —
                unit price first since it's the one filled in directly,
                pack/case price last since it's the derived one (still
                editable, for a supplier quote that doesn't cleanly
                multiply out). */}
            <span className="text-xs font-medium text-muted-foreground">
              Pricing &amp; initial stock (optional)
            </span>
            <div className="form-grid form-grid-cols-2">
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
                <div className="field-message-slot" />
              </Field>
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
                <div className="field-message-slot">
                  <FieldDescription>
                    Recorded as a received-stock ledger movement, not set
                    directly.
                  </FieldDescription>
                </div>
              </Field>
            </div>
            <div className="form-grid form-grid-cols-3">
              {unitPriceField}
              {unitsPerPackField}
              {packPriceField}
            </div>
            {/* After all the price fields, per the read-only currency
                display's own placement rule — see ReadOnlyCurrencyField.
                Its own row (item 5's "the read-only price fields together")
                — today that's just Currency, but it's the row any future
                read-only price field (e.g. a computed retail/wholesale
                preview) would join. */}
            <div className="form-grid form-grid-cols-2">
              <ReadOnlyCurrencyField idPrefix="new-product" currency={defaultCurrency} />
            </div>

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
            {state && "duplicate" in state ? (
              state.duplicate.isActive ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
                  <span>
                    This product already exists ({state.duplicate.productName}).
                  </span>
                  <Link
                    href={`/products/${state.duplicate.productId}/edit`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    View existing product
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
                  <span>
                    This barcode belonged to a discontinued product (
                    {state.duplicate.productName}) — reactivate it instead of
                    creating a new one?
                  </span>
                  <ReactivateProductButton
                    productId={state.duplicate.productId}
                    productName={state.duplicate.productName}
                  />
                </div>
              )
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={pending || barcodeDuplicate != null}
            >
              {pending ? "Creating…" : "Create product"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
