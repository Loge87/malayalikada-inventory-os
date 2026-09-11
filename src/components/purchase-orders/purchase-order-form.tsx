"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import { createPurchaseOrder } from "@/app/(app)/purchase-orders/actions";
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

type LineItem = { key: string; productVariantId: string; quantity: string };

export function PurchaseOrderForm({
  locations,
  variants,
}: {
  locations: LocationOption[];
  variants: VariantOption[];
}) {
  const [state, formAction, pending] = useActionState(
    createPurchaseOrder,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  // The first row's key comes from a stable `useId()` so it renders identically
  // on the server and the client — no random IDs during render. Extra rows get
  // their keys in the click handler (an event, never during SSR).
  const initialItemKey = useId();
  const [items, setItems] = useState<LineItem[]>(() => [
    { key: initialItemKey, productVariantId: "", quantity: "" },
  ]);
  const [handledState, setHandledState] =
    useState<typeof state>(undefined);

  // Clear the controlled line items once per successful submit (the render-phase
  // "adjust state when something changes" pattern — no effect).
  if (state !== handledState) {
    setHandledState(state);
    if (state && "ok" in state) {
      setItems([
        { key: initialItemKey, productVariantId: "", quantity: "" },
      ]);
    }
  }

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

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      { key: crypto.randomUUID(), productVariantId: "", quantity: "" },
    ]);
  }

  function removeItem(key: string) {
    setItems((current) =>
      current.length === 1
        ? current
        : current.filter((item) => item.key !== key)
    );
  }

  const serializedItems = JSON.stringify(
    items
      .filter((item) => item.productVariantId && Number(item.quantity) > 0)
      .map((item) => ({
        product_variant_id: item.productVariantId,
        quantity_ordered: Number(item.quantity),
      }))
  );

  const canSubmit = locations.length > 0 && variants.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New purchase order</CardTitle>
        <CardDescription>
          Order stock from a supplier. Receiving the PO later records the stock
          into the destination location.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="items" value={serializedItems} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="supplierName">Supplier</FieldLabel>
              <Input
                id="supplierName"
                name="supplierName"
                placeholder="Kerala Traders Pvt Ltd"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="destinationLocationId">
                Destination
              </FieldLabel>
              <Select name="destinationLocationId" items={locationItems}>
                <SelectTrigger id="destinationLocationId" className="w-full">
                  <SelectValue placeholder="Where the stock will be received" />
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

            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium">Line items</span>
              {items.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col gap-2 rounded-lg border border-border p-2.5 sm:flex-row sm:items-end"
                >
                  <Field className="sm:flex-1">
                    <FieldLabel htmlFor={`variant-${item.key}`}>
                      Variant
                    </FieldLabel>
                    <Select
                      items={variantItems}
                      value={item.productVariantId || null}
                      onValueChange={(value) =>
                        updateItem(item.key, {
                          productVariantId:
                            typeof value === "string" ? value : "",
                        })
                      }
                    >
                      <SelectTrigger
                        id={`variant-${item.key}`}
                        className="w-full"
                      >
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

                  <Field className="sm:w-28">
                    <FieldLabel htmlFor={`quantity-${item.key}`}>
                      Quantity
                    </FieldLabel>
                    <Input
                      id={`quantity-${item.key}`}
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      placeholder="0"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(item.key, { quantity: event.target.value })
                      }
                    />
                  </Field>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.key)}
                    disabled={items.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={addItem}
              >
                Add line item
              </Button>
            </div>

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
              {pending ? "Creating…" : "Create purchase order"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
