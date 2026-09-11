"use client";

import { useState } from "react";

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

/**
 * Currency + pack/unit pricing fields, grouped under one heading. Shared by
 * every place a variant's price is set — variant creation (via
 * VariantExtraFields, alongside the initial-stock fields) and editing an
 * existing variant (alone, in the product edit drawer) — so pricing behaves
 * identically everywhere rather than being reimplemented per form.
 */
export function VariantPricingFields({
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
}) {
  const [packPrice, setPackPrice] = useState(
    defaultPackPrice != null ? String(defaultPackPrice) : ""
  );
  const [unitsPerPack, setUnitsPerPack] = useState(String(defaultUnitsPerPack));
  const [unitPrice, setUnitPrice] = useState(
    defaultUnitPrice != null ? String(defaultUnitPrice) : ""
  );
  const [unitPriceTouched, setUnitPriceTouched] = useState(false);

  function recalcUnitPrice(nextPackPrice: string, nextUnitsPerPack: string) {
    if (unitPriceTouched) return;
    const pp = Number(nextPackPrice);
    const upp = Number(nextUnitsPerPack);
    if (
      nextPackPrice !== "" &&
      Number.isFinite(pp) &&
      Number.isFinite(upp) &&
      upp > 0
    ) {
      setUnitPrice((pp / upp).toFixed(2));
    } else {
      setUnitPrice("");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-muted-foreground">
        Pricing
      </span>
      <Field orientation="responsive">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-currency`}>Currency</FieldLabel>
          <Select
            name="currency"
            defaultValue={defaultCurrency}
            items={CURRENCY_ITEMS}
          >
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
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-packPrice`}>
            Pack / case price
          </FieldLabel>
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
              recalcUnitPrice(event.target.value, unitsPerPack);
            }}
          />
        </Field>
      </Field>

      <Field orientation="responsive">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-unitsPerPack`}>
            Units per pack/case
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
              recalcUnitPrice(packPrice, event.target.value);
            }}
          />
          <FieldDescription>1 = sold individually.</FieldDescription>
        </Field>
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
              setUnitPriceTouched(true);
            }}
          />
          <FieldDescription>
            {unitPriceTouched
              ? "Set manually."
              : "Auto-calculated from pack price ÷ units per pack — edit to override."}
          </FieldDescription>
        </Field>
      </Field>
    </div>
  );
}
