"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { recordStockOut } from "@/app/(app)/stock-out/actions";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
import { toastManager } from "@/components/ui/toast";
import type {
  ClientOption,
  LocationOption,
} from "@/components/stock-out/stock-out-lookup";

/**
 * The "Stock Out" popup — Location (searchable, this user's assigned +
 * active locations only), Quantity, Client (searchable). The actual on_hand
 * sufficiency check happens server-side (record_stock_out RPC), not here —
 * this just surfaces whatever error it raises.
 */
export function StockOutDialog({
  open,
  onOpenChange,
  variantId,
  variantLabel,
  myLocations,
  clients,
  stockByLocationId,
  onStockedOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variantId: string;
  variantLabel: string;
  /** This user's assigned + active locations only (user_locations) — never
   *  every location in the org. */
  myLocations: LocationOption[];
  clients: ClientOption[];
  /** This variant's on_hand per location_id, from the same scan result —
   *  drives the "no stock available" pre-check below. A location this
   *  variant has never had any stock at simply won't be a key here, same
   *  as 0. */
  stockByLocationId: Record<string, number>;
  /** Fires after a successful stock-out — resets the scan flow back to its
   *  pre-scan state (button prominence included), not just closing this
   *  dialog. */
  onStockedOut?: () => void;
}) {
  const [state, formAction, pending] = useActionState(recordStockOut, undefined);
  const router = useRouter();

  // Defaults to the sole assigned location when there's only one (Stage 4
  // point 2) — still shown as a dropdown, just pre-filled; otherwise starts
  // unset, forcing a deliberate choice among several.
  const [locationId, setLocationId] = useState<string | null>(
    myLocations.length === 1 ? myLocations[0].id : null
  );
  const [clientId, setClientId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");

  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      toastManager.add({ title: `${variantLabel} stocked out`, type: "success" });
      onOpenChange(false);
      onStockedOut?.();
    }
  }, [state, router, variantLabel, onOpenChange, onStockedOut]);

  const locationItems: Record<string, string> = Object.fromEntries(
    myLocations.map((l) => [l.id, l.name])
  );
  const clientItems: Record<string, string> = Object.fromEntries(
    clients.map((c) => [c.id, c.name])
  );

  // UX pre-check only — the real, authoritative sufficiency check is
  // record_stock_out's own (unchanged). This just stops an obviously-doomed
  // submission early, with a specific reason, instead of a disabled button
  // and no explanation. null (not 0) when no location is selected yet —
  // for a multi-location user, there's nothing to check until they pick
  // one; for the single-location case, locationId is already set at mount,
  // so this evaluates immediately.
  const selectedLocationName = myLocations.find((l) => l.id === locationId)?.name ?? null;
  const availableOnHand = locationId ? (stockByLocationId[locationId] ?? 0) : null;
  const noStockAtLocation = availableOnHand !== null && availableOnHand <= 0;

  function handleSubmit() {
    const formData = new FormData();
    formData.set("productVariantId", variantId);
    formData.set("locationId", locationId ?? "");
    formData.set("clientId", clientId ?? "");
    formData.set("quantity", quantity);
    // formAction is a useActionState action — calling it directly (this is
    // a plain button, not a <form action=...>) requires startTransition,
    // same fix as team-management.tsx's locationsAction/roleAction.
    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stock out</DialogTitle>
          <DialogDescription>{variantLabel}</DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="stock-out-location">Location</FieldLabel>
            {myLocations.length === 1 ? (
              // Only one valid option — nothing to choose, so show it as a
              // read-only fact rather than a dropdown that offers a choice
              // that isn't really there.
              <Input id="stock-out-location" value={myLocations[0].name} disabled readOnly />
            ) : (
              <Combobox
                id="stock-out-location"
                items={locationItems}
                value={locationId}
                onValueChange={setLocationId}
                placeholder="Search your locations…"
                className="w-full"
              />
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="stock-out-quantity">Quantity</FieldLabel>
            <Input
              id="stock-out-quantity"
              name="quantity"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="stock-out-client">Client</FieldLabel>
            <Combobox
              id="stock-out-client"
              items={clientItems}
              value={clientId}
              onValueChange={setClientId}
              placeholder="Search clients…"
              emptyMessage="No clients yet"
              className="w-full"
            />
          </Field>

          {noStockAtLocation ? (
            <p className="text-sm text-status-warning">
              No stock available at {selectedLocationName}.
            </p>
          ) : null}

          {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}
        </FieldGroup>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !locationId || !clientId || !quantity || noStockAtLocation}
          >
            {pending ? "Recording…" : "Record stock out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
