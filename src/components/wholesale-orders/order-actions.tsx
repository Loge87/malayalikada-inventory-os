"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  cancelOrder,
  dispatchOrder,
  setOrderStatus,
  type OrderActionResult,
} from "@/app/(app)/wholesale-orders/actions";
import type { OrderStatus } from "@/app/(app)/wholesale-orders/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";

export function OrderActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  function run(fn: () => Promise<OrderActionResult>, success: string) {
    start(async () => {
      const res = await fn();
      if ("error" in res) {
        toastManager.add({ title: res.error, type: "error" });
        return;
      }
      toastManager.add({ title: success, type: "success" });
      setCancelling(false);
      router.refresh();
    });
  }

  if (status === "delivered" || status === "cancelled") return null;
  const canCancel = status === "submitted" || status === "approved" || status === "picked";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === "submitted" ? (
          <Button disabled={pending} onClick={() => run(() => setOrderStatus(orderId, "approved"), "Order approved")}>
            Approve order
          </Button>
        ) : null}
        {status === "submitted" || status === "approved" ? (
          <Button
            variant={status === "approved" ? "default" : "outline"}
            disabled={pending}
            onClick={() => run(() => setOrderStatus(orderId, "picked"), "Marked as picked")}
          >
            Mark as picked
          </Button>
        ) : null}
        {status === "approved" || status === "picked" ? (
          <Button
            variant={status === "picked" ? "default" : "outline"}
            disabled={pending}
            onClick={() => run(() => dispatchOrder(orderId), "Order dispatched — stock updated")}
          >
            Dispatch
          </Button>
        ) : null}
        {status === "dispatched" ? (
          <Button disabled={pending} onClick={() => run(() => setOrderStatus(orderId, "delivered"), "Marked as delivered")}>
            Mark as delivered
          </Button>
        ) : null}
        {canCancel && !cancelling ? (
          <Button variant="outline" disabled={pending} onClick={() => setCancelling(true)}>
            Cancel order
          </Button>
        ) : null}
      </div>

      {cancelling ? (
        <div className="flex max-w-xl flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <label className="text-sm font-medium" htmlFor="cancel-reason">
            Cancel this order? The reserved stock is released.
          </label>
          <Input
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
          />
          <div className="flex gap-2">
            <Button disabled={pending} onClick={() => run(() => cancelOrder(orderId, reason), "Order cancelled")}>
              Yes, cancel order
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setCancelling(false)}>
              Keep order
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
