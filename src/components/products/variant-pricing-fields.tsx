"use client";

import { useState, type ReactNode } from "react";

import { CURRENCIES, DEFAULT_CURRENCY, type Currency } from "@/app/(app)/products/constants";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CURRENCY_ITEMS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c, c])
);

export type VariantPricingFieldNodes = {
  currencyField: ReactNode;
  packPriceField: ReactNode;
  unitsPerPackField: ReactNode;
  unitPriceField: ReactNode;
};

/**
 * The currency + pack/unit pricing fields' shared state and markup, as
 * separate field nodes rather than one fixed layout — so a caller with its
 * own grid (new-product-form's 2-column layout pairs these fields with
 * others, e.g. currency+unit) can place each one wherever it needs to,
 * while every caller still shares the exact same auto-calculate-pack-price
 * behavior (unit price × units per pack — pack price is the derived one,
 * overridable, since a supplier sometimes quotes a case price that doesn't
 * cleanly multiply out). `VariantPricingFields` below is the default
 * arrangement, used as-is by the product edit drawer and the "add variant"
 * form.
 *
 * No retail or wholesale price field here — both are calculated
 * (src/lib/price-calculation.ts: retail from unit_price, wholesale from
 * pack_price, via the organisation's Price Settings), never entered
 * manually. This hook only covers the cost-side inputs: currency, unit
 * price, units per pack, and pack price.
 */
export function useVariantPricingFields({
  idPrefix,
  defaultCurrency = DEFAULT_CURRENCY,
  defaultPackPrice = null,
  defaultUnitsPerPack = 1,
  defaultUnitPrice = null,
}: {
  idPrefix: string;
  defaultCurrency?: Currency;
  defaultPackPrice?: number | null;
  defaultUnitsPerPack?: number;
  defaultUnitPrice?: number | null;
}): VariantPricingFieldNodes {
  const [packPrice, setPackPrice] = useState(
    defaultPackPrice != null ? String(defaultPackPrice) : ""
  );
  const [unitsPerPack, setUnitsPerPack] = useState(String(defaultUnitsPerPack));
  const [unitPrice, setUnitPrice] = useState(
    defaultUnitPrice != null ? String(defaultUnitPrice) : ""
  );
  const [packPriceTouched, setPackPriceTouched] = useState(false);

  function recalcPackPrice(nextUnitPrice: string, nextUnitsPerPack: string) {
    if (packPriceTouched) return;
    const up = Number(nextUnitPrice);
    const upp = Number(nextUnitsPerPack);
    if (
      nextUnitPrice !== "" &&
      Number.isFinite(up) &&
      Number.isFinite(upp) &&
      upp > 0
    ) {
      setPackPrice((up * upp).toFixed(2));
    } else {
      setPackPrice("");
    }
  }

  const currencyField = (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-currency`}>Currency</FieldLabel>
      <Select name="currency" defaultValue={defaultCurrency} items={CURRENCY_ITEMS}>
        <SelectTrigger id={`${idPrefix}-currency`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CURRENCIES.map((currency) => (
            <SelectItem key={currency} value={currency}>
              {currency}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  const unitPriceField = (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-unitPrice`}>Unit price</FieldLabel>
      <Input
        id={`${idPrefix}-unitPrice`}
        name="unitPrice"
        type="number"
        step="0.01"
        min="0"
        placeholder="Optional"
        value={unitPrice}
        onChange={(event) => {
          setUnitPrice(event.target.value);
          recalcPackPrice(event.target.value, unitsPerPack);
        }}
      />
    </Field>
  );

  const unitsPerPackField = (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-unitsPerPack`}>
        Units per pack/case/box
      </FieldLabel>
      <Input
        id={`${idPrefix}-unitsPerPack`}
        name="unitsPerPack"
        type="number"
        step="1"
        min="1"
        value={unitsPerPack}
        onChange={(event) => {
          setUnitsPerPack(event.target.value);
          recalcPackPrice(unitPrice, event.target.value);
        }}
      />
      <FieldDescription>1 = sold individually.</FieldDescription>
    </Field>
  );

  const packPriceField = (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-packPrice`}>Pack / case price</FieldLabel>
      <Input
        id={`${idPrefix}-packPrice`}
        name="packPrice"
        type="number"
        step="0.01"
        min="0"
        placeholder="Optional"
        value={packPrice}
        onChange={(event) => {
          setPackPrice(event.target.value);
          setPackPriceTouched(true);
        }}
      />
      <FieldDescription>
        {packPriceTouched
          ? "Set manually."
          : "Auto-calculated from unit price × units per pack/case/box — edit to override."}
      </FieldDescription>
    </Field>
  );

  return {
    currencyField,
    packPriceField,
    unitsPerPackField,
    unitPriceField,
  };
}

/**
 * Currency + pack/unit pricing fields, grouped under one heading, in their
 * default arrangement. Shared by every place a variant's price is set —
 * variant creation (via VariantExtraFields, alongside the initial-stock
 * fields) and editing an existing variant (alone, in the product edit
 * drawer) — so pricing behaves identically everywhere rather than being
 * reimplemented per form.
 */
export function VariantPricingFields(
  props: Parameters<typeof useVariantPricingFields>[0]
) {
  const { currencyField, packPriceField, unitsPerPackField, unitPriceField } =
    useVariantPricingFields(props);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-muted-foreground">Pricing</span>
      <Field orientation="responsive">
        {currencyField}
        {unitPriceField}
      </Field>
      <Field orientation="responsive">
        {unitsPerPackField}
        {packPriceField}
      </Field>
      {/* No retail/wholesale inputs here — both are calculated
          (src/lib/price-calculation.ts) and shown read-only elsewhere
          (see ProductEditContent's CalculatedPrices block). */}
    </div>
  );
}
