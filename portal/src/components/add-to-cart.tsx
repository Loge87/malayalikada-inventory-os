"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addToCart } from "@/app/cart-actions";
import { QtyControl } from "@/components/qty-control";

export function AddToCart({ variantId, maxCases }: { variantId: string; maxCases: number }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    start(async () => {
      const res = await addToCart(variantId, qty);
      if (res.ok) {
        setAdded(true);
        router.refresh();
        setTimeout(() => setAdded(false), 2600);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col items-stretch gap-2">
        <div className="flex justify-center">
        <QtyControl value={qty} onChange={setQty} max={Math.max(maxCases, 1)} disabled={pending} />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="btn btn-primary btn-sm w-full !px-3"
        >
          {pending ? "Adding…" : added ? "✓ Added" : "Add to cart"}
        </button>
      </div>
      {added ? (
        <Link href="/cart" className="text-xs font-semibold text-brand underline">View cart →</Link>
      ) : null}
      {error ? <p className="text-xs text-danger" role="alert">{error}</p> : null}
    </div>
  );
}
