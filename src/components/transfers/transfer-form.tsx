"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createTransfer } from "@/app/(app)/transfers/actions";
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
import { toastManager } from "@/components/ui/toast";

export type LocationOption = { id: string; name: string };
export type VariantOption = { id: string; label: string };

/**
 * CORRECTED this pass (item 9): used to be its own standalone <Card> sitting
 * directly on the page — now lives inside a dialog (TransfersPageHeader),
 * same "form inside a DialogContent" shape as ClientForm/LocationForm, so
 * the outer Card/CardHeader/CardTitle is gone (DialogHeader/DialogTitle in
 * the dialog itself now carries that framing). The actual field markup,
 * validation (canSubmit below), and the error path (state.error/FieldError
 * — this is where record_stock_transfer's "insufficient stock" error
 * surfaces) are byte-for-byte unchanged, per this pass's explicit
 * instruction to keep that behavior exactly as it was. `onCreated` closes
 * the dialog and router.refresh()/toastManager.add give this the same
 * success feedback every other create-via-dialog form in the app already
 * has (ClientForm, LocationForm) — this form just never had it yet.
 */
export function TransferForm({
  locations,
  variants,
  onCreated,
}: {
  locations: LocationOption[];
  variants: VariantOption[];
  onCreated?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createTransfer,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
      router.refresh();
      toastManager.add({ title: "Transfer created", type: "success" });
      onCreated?.();
    }
  }, [state, router, onCreated]);

  const locationItems: Record<string, string> = Object.fromEntries(
    locations.map((l) => [l.id, l.name])
  );
  const variantItems: Record<string, string> = Object.fromEntries(
    variants.map((v) => [v.id, v.label])
  );

  const canSubmit = locations.length >= 2 && variants.length > 0;

  return (
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
  );
}
