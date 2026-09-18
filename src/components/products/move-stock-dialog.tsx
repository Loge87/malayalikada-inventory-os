"use client";

import { useActionState, useEffect, useMemo } from "react";

import { bulkMoveStock } from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LocationOption } from "@/components/products/variant-extra-fields";

export type MoveStockVariant = { id: string; label: string; onHand: number };

/**
 * Moves stock for several selected variants from one location to another in
 * one action. Each line still goes through record_stock_transfer individually
 * (see bulkMoveStock in products/actions.ts) — this is a batch of ordinary
 * transfers, not a new movement type, all sharing one reference_id.
 */
export function MoveStockDialog({
  open,
  onOpenChange,
  variants,
  locations,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variants: MoveStockVariant[];
  locations: LocationOption[];
  onMoved: () => void;
}) {
  const [state, formAction, pending] = useActionState(bulkMoveStock, undefined);
  const variantIdsJson = useMemo(
    () => JSON.stringify(variants.map((v) => v.id)),
    [variants]
  );

  useEffect(() => {
    if (state && "ok" in state) {
      onMoved();
    }
    // Deliberately state-only: onMoved (a parent callback that sets the
    // parent's state) must run post-commit, not during this component's
    // render — and excluding it keeps this from re-firing if the parent
    // passes a new onMoved reference without the action state itself
    // changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const locationItems: Record<string, string> = Object.fromEntries(
    locations.map((l) => [l.id, l.name])
  );
  const canSubmit = locations.length >= 2 && variants.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move stock</DialogTitle>
          <DialogDescription>
            Moves the selected items from one location to another — each item
            is recorded as its own TRANSFER_OUT / TRANSFER_IN pair.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="variantIds" value={variantIdsJson} />
          <FieldGroup>
            <Field orientation="responsive">
              <Field>
                <FieldLabel htmlFor="move-source">From</FieldLabel>
                <Select name="sourceLocationId" items={locationItems}>
                  <SelectTrigger id="move-source" className="w-full">
                    <SelectValue placeholder="Source location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="move-destination">To</FieldLabel>
                <Select name="destinationLocationId" items={locationItems}>
                  <SelectTrigger id="move-destination" className="w-full">
                    <SelectValue placeholder="Destination location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </Field>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Quantity to move per item (leave 0 to skip)
              </span>
              <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {variants.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <label
                      htmlFor={`move-qty-${v.id}`}
                      className="min-w-0 flex-1 truncate text-sm"
                    >
                      {v.label}{" "}
                      <span className="text-muted-foreground">
                        ({v.onHand} on hand)
                      </span>
                    </label>
                    <Input
                      id={`move-qty-${v.id}`}
                      name={`quantity-${v.id}`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      className="w-20 shrink-0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}
            {!canSubmit ? (
              <FieldError>
                You need at least two locations and one selected item to move
                stock.
              </FieldError>
            ) : null}
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending ? "Moving…" : "Move stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
