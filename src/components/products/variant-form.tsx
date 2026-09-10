"use client";

import { useActionState, useEffect, useRef } from "react";

import { createVariant } from "@/app/products/actions";
import { VARIANT_UNITS } from "@/app/products/constants";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNIT_ITEMS: Record<string, string> = Object.fromEntries(
  VARIANT_UNITS.map((unit) => [unit, unit])
);

export function VariantForm({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState(createVariant, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-3">
      <input type="hidden" name="productId" value={productId} />
      <FieldGroup>
        <Field orientation="responsive">
          <Field>
            <FieldLabel htmlFor={`variant-name-${productId}`}>
              Variant
            </FieldLabel>
            <Input
              id={`variant-name-${productId}`}
              name="name"
              placeholder="1kg pouch"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`variant-sku-${productId}`}>SKU</FieldLabel>
            <Input
              id={`variant-sku-${productId}`}
              name="sku"
              placeholder="RICE-BAS-1KG"
              required
            />
          </Field>
        </Field>
        <Field orientation="responsive">
          <Field>
            <FieldLabel htmlFor={`variant-barcode-${productId}`}>
              Barcode
            </FieldLabel>
            <Input
              id={`variant-barcode-${productId}`}
              name="barcode"
              placeholder="Optional"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`variant-unit-${productId}`}>Unit</FieldLabel>
            <Select name="unit" defaultValue="each" items={UNIT_ITEMS}>
              <SelectTrigger
                id={`variant-unit-${productId}`}
                className="w-full"
              >
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
        </Field>

        {state && "error" in state ? (
          <FieldError>{state.error}</FieldError>
        ) : null}

        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={pending}
          className="w-fit"
        >
          {pending ? "Adding…" : "Add variant"}
        </Button>
      </FieldGroup>
    </form>
  );
}
