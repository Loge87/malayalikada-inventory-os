"use client";

import { useActionState, useEffect, useRef } from "react";

import { createTransfer } from "@/app/(app)/transfers/actions";
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

export function TransferForm({
  locations,
  variants,
}: {
  locations: LocationOption[];
  variants: VariantOption[];
}) {
  const [state, formAction, pending] = useActionState(
    createTransfer,
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

  const canSubmit = locations.length >= 2 && variants.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New stock transfer</CardTitle>
        <CardDescription>
          Moves stock between two locations as a single ledger event —
          TRANSFER_OUT at the source and TRANSFER_IN at the destination.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="sourceLocationId">From</FieldLabel>
              <Select name="sourceLocationId" items={locationItems}>
                <SelectTrigger id="sourceLocationId" className="w-full">
                  <SelectValue placeholder="Source location" />
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
              <FieldLabel htmlFor="destinationLocationId">To</FieldLabel>
              <Select name="destinationLocationId" items={locationItems}>
                <SelectTrigger id="destinationLocationId" className="w-full">
                  <SelectValue placeholder="Destination location" />
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
              <FieldLabel htmlFor="quantity">Quantity</FieldLabel>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
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
                You need at least two locations and one product variant to
                transfer stock.
              </FieldError>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={pending || !canSubmit}
            >
              {pending ? "Transferring…" : "Create transfer"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
