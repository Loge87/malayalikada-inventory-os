"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { recordMovement } from "@/app/(app)/movements/actions";
import {
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
} from "@/app/(app)/movements/constants";
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

export type LocationOption = { id: string; name: string };
export type VariantOption = { id: string; label: string };

const MOVEMENT_TYPE_ITEMS: Record<string, string> = Object.fromEntries(
  MOVEMENT_TYPES.map((type) => [type, MOVEMENT_TYPE_LABELS[type]])
);

export function MovementForm({
  locations,
  variants,
}: {
  locations: LocationOption[];
  variants: VariantOption[];
}) {
  const [state, formAction, pending] = useActionState(
    recordMovement,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [movementType, setMovementType] = useState("PURCHASE_RECEIVED");
  const [handledState, setHandledState] = useState<typeof state>(undefined);

  // Reset the controlled movement type once per successful submit (render-phase
  // "adjust state when something changes" pattern — no effect).
  if (state !== handledState) {
    setHandledState(state);
    if (state && "ok" in state) {
      setMovementType("PURCHASE_RECEIVED");
    }
  }

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
    }
  }, [state]);

  const isReceipt = movementType === "PURCHASE_RECEIVED";

  const locationItems: Record<string, string> = Object.fromEntries(
    locations.map((l) => [l.id, l.name])
  );
  const variantItems: Record<string, string> = Object.fromEntries(
    variants.map((v) => [v.id, v.label])
  );

  const canSubmit = locations.length > 0 && variants.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record stock movement</CardTitle>
        <CardDescription>
          Every stock change is recorded as a movement through the inventory
          ledger.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="locationId">Location</FieldLabel>
              <Select name="locationId" items={locationItems}>
                <SelectTrigger id="locationId" className="w-full">
                  <SelectValue placeholder="Select a location" />
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
              <FieldLabel htmlFor="productVariantId">
                Product variant
              </FieldLabel>
              <Select name="productVariantId" items={variantItems}>
                <SelectTrigger id="productVariantId" className="w-full">
                  <SelectValue placeholder="Select a variant" />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="movementType">Movement type</FieldLabel>
              <Select
                name="movementType"
                value={movementType}
                onValueChange={(value) =>
                  setMovementType(typeof value === "string" ? value : "")
                }
                items={MOVEMENT_TYPE_ITEMS}
              >
                <SelectTrigger id="movementType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {MOVEMENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="quantity">Quantity</FieldLabel>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                step="1"
                inputMode="numeric"
                placeholder="0"
                required
              />
            </Field>

            {isReceipt ? (
              <>
                <Field>
                  <FieldLabel htmlFor="batchNumber">
                    Batch number (optional)
                  </FieldLabel>
                  <Input
                    id="batchNumber"
                    name="batchNumber"
                    placeholder="e.g. LOT-2026-014"
                  />
                  <FieldDescription>
                    Records a batch in inventory_batches for expiry tracking.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="expiryDate">
                    Expiry date (optional)
                  </FieldLabel>
                  <Input id="expiryDate" name="expiryDate" type="date" />
                </Field>
              </>
            ) : null}

            {state && "error" in state ? (
              <FieldError>{state.error}</FieldError>
            ) : null}

            {!canSubmit ? (
              <FieldError>
                Add at least one location and one product variant first.
              </FieldError>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={pending || !canSubmit}
            >
              {pending ? "Recording…" : "Record movement"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
