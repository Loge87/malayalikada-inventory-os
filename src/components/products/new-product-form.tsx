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
import {
  VariantExtraFields,
  type LocationOption,
} from "@/components/products/variant-extra-fields";

const UNIT_ITEMS: Record<string, string> = Object.fromEntries(
  VARIANT_UNITS.map((unit) => [unit, unit])
);

export function NewProductForm({
  barcode,
  locations,
  returnTo = "/products",
  onBack,
}: {
  barcode: string;
  locations: LocationOption[];
  /** Where to land after a successful create — "/scan" for the scan-originated
   *  flow (so the barcode can be re-scanned), otherwise "/products". */
  returnTo?: "/scan" | "/products";
  /** Shown as a "Back" action when this form is one step of a larger flow
   *  (the /products "Add product" chooser) rather than the sole content of
   *  the page. */
  onBack?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createProductWithVariant,
    undefined
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>New product</CardTitle>
        <CardDescription>
          {barcode
            ? "Enter the product and variant details for the scanned barcode."
            : "Add a product and its first variant."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* On success the action redirects, so no reset handling. */}
        <form action={formAction}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <FieldGroup>
            <span className="text-xs font-medium text-muted-foreground">
              Product
            </span>
            <Field>
              <FieldLabel htmlFor="productName">Product name</FieldLabel>
              <Input
                id="productName"
                name="productName"
                placeholder="Basmati Rice"
                required
              />
            </Field>
            <Field orientation="responsive">
              <Field>
                <FieldLabel htmlFor="category">Category</FieldLabel>
                <Input
                  id="category"
                  name="category"
                  placeholder="Grains"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="brand">Brand</FieldLabel>
                <Input id="brand" name="brand" placeholder="Optional" />
              </Field>
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

            <VariantExtraFields idPrefix="new-product" locations={locations} />

            {state && "error" in state ? (
              <FieldError>{state.error}</FieldError>
            ) : null}

            <div className="flex gap-2">
              {onBack ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  disabled={pending}
                >
                  Back
                </Button>
              ) : null}
              <Button
                type="submit"
                className="flex-1"
                disabled={pending}
              >
                {pending ? "Creating…" : "Create product"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
