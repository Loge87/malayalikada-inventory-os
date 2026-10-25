"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

import { placeOrder, setCartQty } from "@/app/cart-actions";
import { ProductImage } from "@/components/product-image";
import { QtyControl } from "@/components/qty-control";
import { formatMoney } from "@/lib/money";

export type CartViewLine = {
  id: string;
  name: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  casePrice: number | null;
  lineTotal: number | null;
  cases: number;
  availableCases: number;
  problem: "no_price" | "out" | "short" | null;
};

const PROBLEM_TEXT: Record<NonNullable<CartViewLine["problem"]>, (l: CartViewLine) => string> = {
  no_price: () => "No price is set for this item yet. Remove it to continue.",
  out: () => "Out of stock right now. Remove it to continue.",
  short: (l) => `Only ${l.availableCases} ${l.availableCases === 1 ? "case" : "cases"} left. Lower the quantity to continue.`,
};

function Line({ line, currency }: { line: CartViewLine; currency: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [qty, setQty] = useState(line.cases);

  function commit(next: number) {
    setQty(next);
    start(async () => {
      await setCartQty(line.id, next);
      router.refresh();
    });
  }

  return (
    <li className={`card flex gap-4 p-4 sm:p-5 ${line.problem ? "border-danger/50" : ""}`}>
      <div className="product-media size-24 shrink-0 overflow-hidden rounded-2xl sm:size-28">
        <ProductImage src={line.imageUrl} alt={line.name} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-semibold leading-snug">{line.name}</h3>
            <p className="text-sm text-muted">{line.variantName} · {line.sku}</p>
          </div>
          <button
            type="button"
            onClick={() => commit(0)}
            disabled={pending}
            className="shrink-0 text-sm font-semibold text-muted underline transition-colors hover:text-danger"
          >
            Remove
          </button>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          <QtyControl value={qty} onChange={commit} disabled={pending} max={Math.max(line.availableCases, qty, 1)} />
          <div className="text-right">
            <div className="text-lg font-extrabold tracking-tight">
              {line.lineTotal !== null ? formatMoney(line.lineTotal, currency) : "—"}
            </div>
            {line.casePrice !== null ? (
              <div className="text-xs text-muted">{formatMoney(line.casePrice, currency)} per case</div>
            ) : null}
          </div>
        </div>
        {line.problem ? <p className="text-sm font-medium text-danger">{PROBLEM_TEXT[line.problem](line)}</p> : null}
      </div>
    </li>
  );
}

export function CartView({
  lines,
  subtotal,
  currency,
  minOrderValue,
  hasProblems,
}: {
  lines: CartViewLine[];
  subtotal: number;
  currency: string;
  minOrderValue: number;
  hasProblems: boolean;
}) {
  const [state, action, pending] = useActionState(placeOrder, undefined);
  const belowMin = subtotal < minOrderValue;
  const progress = Math.min(100, Math.round((subtotal / Math.max(minOrderValue, 1)) * 100));
  const canOrder = !hasProblems && !belowMin && lines.length > 0;

  if (lines.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-12 text-center">
        <div className="text-5xl" aria-hidden>🛒</div>
        <h2 className="mt-4 text-xl font-bold">Your cart is empty</h2>
        <p className="mt-1 text-muted">Add some cases and they will show up here.</p>
        <Link href="/products" className="btn btn-primary mt-6">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <ul className="space-y-4">
        {lines.map((l) => (
          <Line key={`${l.id}-${l.cases}`} line={l} currency={currency} />
        ))}
      </ul>

      <form action={action} className="card space-y-5 p-6 lg:sticky lg:top-28">
        <h2 className="text-lg font-bold">Order summary</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Items</dt><dd className="font-semibold">{lines.length}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Cases</dt><dd className="font-semibold">{lines.reduce((s, l) => s + l.cases, 0)}</dd></div>
          <div className="flex items-baseline justify-between border-t border-line pt-3 text-base">
            <dt className="font-bold">Total</dt>
            <dd className="text-2xl font-extrabold tracking-tight">{formatMoney(subtotal, currency)}</dd>
          </div>
        </dl>

        {belowMin ? (
          <div className="rounded-2xl bg-accent/10 p-4 text-sm">
            <p className="font-semibold">
              Add {formatMoney(minOrderValue - subtotal, currency)} more to reach the {formatMoney(minOrderValue, currency)} minimum order.
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        <label className="block text-sm font-medium">
          Order notes <span className="font-normal text-muted">(optional)</span>
          <textarea name="notes" rows={3} maxLength={1000} className="input mt-1.5" placeholder="Delivery instructions, special requests…" />
        </label>

        {state?.error ? (
          <div className="rounded-2xl bg-danger/10 p-4 text-sm text-danger" role="alert">
            <p className="font-semibold">{state.error}</p>
            {state.shortages && state.shortages.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {state.shortages.map((s) => (
                  <li key={s.sku}>
                    {s.name} ({s.sku}): you asked for {s.requested}, {s.available} available
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <button type="submit" disabled={pending || !canOrder} className="btn btn-primary w-full">
          {pending ? "Placing order…" : "Place order"}
        </button>
        <p className="text-center text-xs text-muted">
          Stock is reserved when you place the order. You can cancel it online until we approve it.
        </p>
      </form>
    </div>
  );
}
