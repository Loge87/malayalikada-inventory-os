"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  saveShipmentCosts,
} from "@/app/(app)/settings/shipment-cost-actions";
import type { ShipmentCosts } from "@/lib/price-formula";
import { PRICE_VARIABLE_TYPES } from "@/lib/price-variable-types";
import { PRODUCT_TYPES, PRODUCT_TYPE_LABELS } from "@/lib/product-type";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastManager } from "@/components/ui/toast";

const TYPE_LABELS = {
  number: "Number",
  percentage: "Percentage",
  currency: "Currency",
} as const;

/** Settings → Price Settings, right panel: the shipment cost added to the
 *  retail and wholesale price of every Frozen / Dry product. */
export function ShipmentCostPanel({ costs }: { costs: ShipmentCosts }) {
  const [state, formAction, pending] = useActionState(saveShipmentCosts, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      toastManager.add({ title: "Shipment cost saved", type: "success" });
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <h2 className="text-section-title">Shipment cost</h2>
        <p className="text-caption">
          Added to the retail and wholesale price of every product of that
          type. A percentage is taken from the price calculated so far.
        </p>
      </div>

      {PRODUCT_TYPES.map((type) => (
        <div key={type} className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`shipment-${type}-value`}>
              {PRODUCT_TYPE_LABELS[type]}
            </FieldLabel>
            <Input
              id={`shipment-${type}-value`}
              name={`${type}Value`}
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              defaultValue={costs[type]?.value ?? 0}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`shipment-${type}-type`}>Type</FieldLabel>
            <Select
              name={`${type}Type`}
              defaultValue={costs[type]?.valueType ?? "number"}
              items={TYPE_LABELS}
            >
              <SelectTrigger id={`shipment-${type}-type`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICE_VARIABLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      ))}

      {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}

      <Button type="submit" size="sm" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save shipment cost"}
      </Button>
    </form>
  );
}
