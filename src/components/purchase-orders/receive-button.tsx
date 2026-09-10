"use client";

import { useActionState } from "react";

import { receivePurchaseOrder } from "@/app/purchase-orders/actions";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";

export function ReceiveButton({ purchaseOrderId }: { purchaseOrderId: string }) {
  const [state, formAction, pending] = useActionState(
    receivePurchaseOrder,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Receiving…" : "Receive"}
      </Button>
      {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
