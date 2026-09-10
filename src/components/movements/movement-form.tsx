"use client";

import { useActionState, useEffect, useRef } from "react";

import { recordMovement } from "@/app/movements/actions";
import {
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
} from "@/app/movements/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
    }
  }, [state]);

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
                defaultValue="PURCHASE_RECEIVED"
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
