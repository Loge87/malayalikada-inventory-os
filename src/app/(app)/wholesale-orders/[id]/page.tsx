import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OrderActions } from "@/components/wholesale-orders/order-actions";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE, type OrderStatus } from "../status";

type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function WholesaleOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "wholesale:manage")) redirect("/dashboard");

  const { id } = await params;
  const { data: order, error } = await supabase
    .from("portal_orders")
    .select(
      "id, order_number, status, currency, total, notes, cancel_reason, seen_at, placed_at, approved_at, picked_at, dispatched_at, delivered_at, cancelled_at, retailers(business_name, contact_name, email, phone, address)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!order) notFound();

  // Opening an order marks it as seen (clears the "new" dot in the list).
  if (order.seen_at === null) {
    await supabase.from("portal_orders").update({ seen_at: new Date().toISOString() }).eq("id", id);
  }

  const { data: items } = await supabase
    .from("portal_order_items")
    .select("id, product_name, sku, units_per_case, cases, case_price, line_total")
    .eq("order_id", id)
    .order("product_name");
  const itemIds = (items ?? []).map((i) => i.id);
  const { data: allocs } = itemIds.length
    ? await supabase
        .from("portal_order_allocations")
        .select("order_item_id, quantity, locations(name)")
        .in("order_item_id", itemIds)
    : { data: [] };

  const pickFrom = new Map<string, string[]>();
  for (const a of allocs ?? []) {
    const loc = one(a.locations as One<{ name: string }>);
    const list = pickFrom.get(a.order_item_id) ?? [];
    list.push(`${loc?.name ?? "Location"} (${Number(a.quantity)})`);
    pickFrom.set(a.order_item_id, list);
  }

  const status = order.status as OrderStatus;
  const retailer = one(order.retailers as One<{ business_name: string; contact_name: string | null; email: string; phone: string | null; address: string | null }>);
  const currency = order.currency as string;

  const timeline = [
    { label: "Placed", at: order.placed_at },
    { label: "Approved", at: order.approved_at },
    { label: "Picked", at: order.picked_at },
    { label: "Dispatched", at: order.dispatched_at },
    { label: "Delivered", at: order.delivered_at },
    { label: "Cancelled", at: order.cancelled_at },
  ].filter((t) => t.at);

  return (
    <div className="flex w-full flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <Link href="/wholesale-orders" className="text-sm text-muted-foreground hover:text-foreground">
          ← Wholesale orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-page-title">Order #{Number(order.order_number)}</h1>
          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", ORDER_STATUS_STYLE[status])}>
            {ORDER_STATUS_LABEL[status]}
          </span>
        </div>
        <p className="text-page-subtitle">
          {retailer?.business_name ?? "Retailer"} · placed {formatDateTime(order.placed_at)}
        </p>
      </div>

      <OrderActions orderId={order.id} status={status} />

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {(items ?? []).map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <div className="font-medium">{i.product_name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {i.sku} · {Number(i.units_per_case)} per case
                  </div>
                  {pickFrom.get(i.id) ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Pick from: {pickFrom.get(i.id)!.join(", ")}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold tabular-nums">{formatMoney(Number(i.line_total), currency)}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {Number(i.cases)} × {formatMoney(Number(i.case_price), currency)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-4 sm:px-5">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-bold tabular-nums">{formatMoney(Number(order.total), currency)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Retailer</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="font-medium">{retailer?.business_name}</div>
              {retailer?.contact_name ? <div className="text-muted-foreground">{retailer.contact_name}</div> : null}
              {retailer?.email ? <div><a className="underline" href={`mailto:${retailer.email}`}>{retailer.email}</a></div> : null}
              {retailer?.phone ? <div className="text-muted-foreground">{retailer.phone}</div> : null}
              {retailer?.address ? <div className="text-muted-foreground">{retailer.address}</div> : null}
            </dl>
            {order.notes ? (
              <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
                <div className="text-xs font-semibold text-muted-foreground">Retailer note</div>
                {order.notes}
              </div>
            ) : null}
            {order.cancel_reason ? (
              <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
                <div className="text-xs font-semibold text-muted-foreground">Cancel reason</div>
                {order.cancel_reason}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Timeline</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {timeline.map((t) => (
                <li key={t.label} className="flex justify-between gap-3">
                  <span>{t.label}</span>
                  <span className="text-muted-foreground">{formatDateTime(t.at as string)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
