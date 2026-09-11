"use client";

import { useState } from "react";

import { CURRENCIES, DEFAULT_CURRENCY } from "@/app/products/constants";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type LocationOption = { id: string; name: string };

const CURRENCY_ITEMS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c, c])
);

/**
 * Pricing + optional initial-stock fields, shared by every place a variant is
 * created — the /products "add variant" form and the /products/new scan flow
 * — so the two stay identical rather than drifting into separate
 * implementations. Field `name`s are read directly by the server action.
 */
export function VariantExtraFields({
  idPrefix,
  locations,
}: {
  /** Disambiguates element ids when several instances render on one page. */
  idPrefix: string;
  locations: LocationOption[];
}) {
  const [packPrice, setPackPrice] = useState("");
  const [unitsPerPack, setUnitsPerPack] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
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

  const locationItems: Record<string, string> = Object.fromEntries(
    locations.map((l) => [l.id, l.name])
  );

  return (
    <>
      <Field orientation="responsive">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-currency`}>Currency</FieldLabel>
          <Select
            name="currency"
            defaultValue={DEFAULT_CURRENCY}
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

      <Field orientation="responsive">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-initialLocationId`}>
            Initial stock location
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
            Initial quantity
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
    </>
  );
}
