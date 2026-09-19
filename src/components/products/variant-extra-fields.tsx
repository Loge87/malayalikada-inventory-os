"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ReadOnlyCurrencyField,
  VariantPricingFields,
} from "@/components/products/variant-pricing-fields";
import type { Currency } from "@/app/(app)/products/constants";

export type LocationOption = { id: string; name: string };

/**
 * Pricing + optional initial-stock fields for CREATING a variant — shared by
 * every variant-creation entry point (the /products "add variant" form and
 * the unified add-product flow), so they stay identical rather than drifting
 * into separate implementations. Field `name`s are read directly by the
 * server action. Editing an existing variant uses VariantPricingFields alone
 * (no stock step — that's what /movements and /stock-counts are for).
 */
export function VariantExtraFields({
  idPrefix,
  locations,
  defaultCurrency,
}: {
  /** Disambiguates element ids when several instances render on one page. */
  idPrefix: string;
  locations: LocationOption[];
  /** The organisation's current Price Settings currency — this NEW
   *  variant's currency is always set to this, server-side (products/
   *  actions.ts), no per-variant override. Shown read-only, after the
   *  price fields. */
  defaultCurrency: Currency;
}) {
  const locationItems: Record<string, string> = Object.fromEntries(
    locations.map((l) => [l.id, l.name])
  );

  return (
    <>
      <VariantPricingFields idPrefix={idPrefix} />
      <ReadOnlyCurrencyField idPrefix={idPrefix} currency={defaultCurrency} />

      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium text-muted-foreground">
          Initial stock (optional)
        </span>
        <Field orientation="responsive">
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-initialLocationId`}>
              Location
            </FieldLabel>
            <Select name="initialLocationId" items={locationItems}>
              <SelectTrigger
                id={`${idPrefix}-initialLocationId`}
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
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-initialQuantity`}>
              Quantity
            </FieldLabel>
            <Input
              id={`${idPrefix}-initialQuantity`}
              name="initialQuantity"
              type="number"
              step="1"
              min="0"
              placeholder="Optional"
            />
            <FieldDescription>
              Recorded as a received-stock ledger movement, not set directly.
            </FieldDescription>
          </Field>
        </Field>
      </div>
    </>
  );
}
