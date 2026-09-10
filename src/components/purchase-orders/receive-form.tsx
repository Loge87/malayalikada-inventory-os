"use client";

import { useActionState, useState } from "react";

import { receivePurchaseOrder } from "@/app/purchase-orders/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type ReceiveItem = { id: string; label: string };

type BatchEntry = { batchNumber: string; expiryDate: string };

export function ReceiveForm({
  purchaseOrderId,
  items,
}: {
  purchaseOrderId: string;
  items: ReceiveItem[];
}) {
  const [state, formAction, pending] = useActionState(
    receivePurchaseOrder,
    undefined
  );
  const [expanded, setExpanded] = useState(false);
  const [batchByItem, setBatchByItem] = useState<Record<string, BatchEntry>>({});

  function update(itemId: string, patch: Partial<BatchEntry>) {
    setBatchByItem((current) => {
      const existing = current[itemId] ?? { batchNumber: "", expiryDate: "" };
      return { ...current, [itemId]: { ...existing, ...patch } };
    });
  }

  const serializedBatches = JSON.stringify(
    items
      .map((item) => ({
        purchase_order_item_id: item.id,
        batch_number: (batchByItem[item.id]?.batchNumber ?? "").trim(),
        expiry_date: batchByItem[item.id]?.expiryDate || null,
      }))
      .filter((entry) => entry.batch_number || entry.expiry_date)
  );

  if (!expanded) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-fit"
        onClick={() => setExpanded(true)}
      >
        Receive
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
      <input type="hidden" name="batches" value={serializedBatches} />

      <span className="text-muted-foreground text-xs font-medium">
        Batch &amp; expiry — optional, per line
      </span>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-lg border border-border p-2.5 sm:flex-row sm:items-end"
          >
            <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
            <Field className="sm:w-40">
              <FieldLabel htmlFor={`batch-${item.id}`}>Batch no.</FieldLabel>
              <Input
                id={`batch-${item.id}`}
                value={batchByItem[item.id]?.batchNumber ?? ""}
                onChange={(event) =>
                  update(item.id, { batchNumber: event.target.value })
                }
                placeholder="optional"
              />
            </Field>
            <Field className="sm:w-40">
              <FieldLabel htmlFor={`expiry-${item.id}`}>Expiry</FieldLabel>
              <Input
                id={`expiry-${item.id}`}
                type="date"
                value={batchByItem[item.id]?.expiryDate ?? ""}
                onChange={(event) =>
                  update(item.id, { expiryDate: event.target.value })
                }
              />
            </Field>
          </div>
        ))}
      </div>

      {state && "error" in state ? (
        <FieldError>{state.error}</FieldError>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Receiving…" : "Confirm receipt"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setExpanded(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
