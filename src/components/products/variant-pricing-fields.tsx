"use client";

import { useState, type ReactNode } from "react";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type VariantPricingFieldNodes = {
  packPriceField: ReactNode;
  unitsPerPackField: ReactNode;
  unitPriceField: ReactNode;
};

/**
 * Read-only — currency is no longer a per-variant choice (removed the
 * editable dropdown here): every variant's currency now always tracks the
 * organisation's current Price Settings currency, set in products/
 * actions.ts server-side, not submitted from this form at all (no `name`
 * attribute — nothing to send). This just shows what that value is.
 */
export function ReadOnlyCurrencyField({
  idPrefix,
  currency,
}: {
  idPrefix: string;
  currency: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-currency`}>Currency</FieldLabel>
      <Input id={`${idPrefix}-currency`} value={currency} disabled />
      <FieldDescription>Set in Price Settings.</FieldDescription>
    </Field>
  );
}

/**
 * The pack/unit pricing fields' shared state and markup, as separate field
 * nodes rather than one fixed layout — so a caller with its own grid
 * (new-product-form's 2-column layout pairs these fields with others, e.g.
 * unit price+quantity) can place each one wherever it needs to, while every
 * caller still shares the exact same auto-calculate-pack-price behavior
 * (unit price × units per pack — pack price is the derived one, overridable,
 * since a supplier sometimes quotes a case price that doesn't cleanly
 * multiply out). `VariantPricingFields` below is the default arrangement,
 * used as-is by the product edit drawer and the "add variant" form.
 *
 * No currency field here — see ReadOnlyCurrencyField above. No retail or
 * wholesale price field either — both are calculated
 * (src/lib/price-calculation.ts: retail from unit_price, wholesale from
 * pack_price, via the organisation's Price Settings), never entered
 * manually. This hook only covers the cost-side inputs: unit price, units
 * per pack, and pack price.
 */
export function useVariantPricingFields({
  idPrefix,
  defaultPackPrice = null,
  defaultUnitsPerPack = 1,
  defaultUnitPrice = null,
}: {
  idPrefix: string;
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
    packPriceField,
    unitsPerPackField,
    unitPriceField,
  };
}

/**
 * Pack/unit pricing fields, grouped under one heading, in their default
 * arrangement. Shared by every place a variant's price is set — variant
 * creation (via VariantExtraFields, alongside the initial-stock fields) and
 * editing an existing variant (alone, in the product edit drawer) — so
 * pricing behaves identically everywhere rather than being reimplemented
 * per form. Doesn't include the read-only currency display or retail/
 * wholesale — where those go depends on each caller's own layout (retail/
 * wholesale, when shown at all, needs the currency display to come after
 * them, and only the edit panel shows them), so each caller renders those
 * itself around this component rather than this owning that ordering.
 */
export function VariantPricingFields(
  props: Parameters<typeof useVariantPricingFields>[0]
) {
  const { packPriceField, unitsPerPackField, unitPriceField } =
    useVariantPricingFields(props);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-muted-foreground">Pricing</span>
      <Field>{unitPriceField}</Field>
      <Field orientation="responsive">
        {unitsPerPackField}
        {packPriceField}
      </Field>
    </div>
  );
}
