"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cancelOrder } from "@/app/cart-actions";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return <button type="button" className="btn btn-sm" onClick={() => setConfirming(true)}>Cancel order</button>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm">Cancel this order and release the stock?</span>
      <button
        type="button"
        className="btn btn-sm btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await cancelOrder(orderId);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Cancelling…" : "Yes, cancel"}
      </button>
      <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>Keep</button>
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </div>
  );
}
