import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CancelOrderButton } from "@/components/cancel-order-button";
import { formatMoney } from "@/lib/catalogue";
import { STATUS_STYLE } from "@/lib/order-status";
import { getCurrentRetailer, getCurrentUser, getOrganisationId } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Order" };

const STEPS = [
  ["submitted", "Placed", "placed_at"],
  ["approved", "Approved", "approved_at"],
  ["picked", "Picked", "picked_at"],
  ["dispatched", "Dispatched", "dispatched_at"],
  ["delivered", "Delivered", "delivered_at"],
] as const;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const [{ id }, { placed }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/orders/${id}`);
  const retailer = await getCurrentRetailer();
  if (!retailer) notFound();

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("portal_orders")
    .select("*")
    .eq("id", id)
    .eq("organisation_id", getOrganisationId())
    .eq("retailer_id", retailer.id)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await admin
    .from("portal_order_items")
    .select("id, product_name, sku, units_per_case, cases, case_price, line_total")
    .eq("order_id", id)
    .order("product_name");

  const cancelled = order.status === "cancelled";
  const reached = STEPS.findIndex(([s]) => s === order.status);

  return (
    <div className="container-page py-10">
      {placed ? (
        <div className="anim-up mb-8 rounded-3xl bg-brand p-8 text-brand-ink">
          <div className="text-4xl" aria-hidden>🎉</div>
          <h1 className="mt-2 text-2xl font-extrabold">Order #{order.order_number} placed</h1>
          <p className="mt-1 opacity-90">Thanks! We have reserved your stock and will confirm shortly.</p>
        </div>
      ) : (
        <h1 className="section-title mb-8">Order #{order.order_number}</h1>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-6">
          <div className="card p-6">
            {cancelled ? (
              <p className="font-semibold text-danger">
                This order was cancelled{order.cancel_reason ? `: ${order.cancel_reason}` : "."}
              </p>
            ) : (
              <ol className="grid grid-cols-5 gap-2 text-center text-xs">
                {STEPS.map(([s, label, col], i) => (
                  <li key={s} className="space-y-2">
                    <div className={`mx-auto grid size-8 place-items-center rounded-full font-bold ${i <= reached ? "bg-brand text-white" : "bg-soft text-muted"}`}>
                      {i <= reached ? "✓" : i + 1}
                    </div>
                    <div className={i <= reached ? "font-semibold" : "text-muted"}>{label}</div>
                    {order[col] ? <div className="text-muted">{new Date(order[col]).toLocaleDateString("en-NZ", { dateStyle: "short" })}</div> : null}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card overflow-hidden">
            <ul className="divide-y divide-line">
              {(items ?? []).map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="font-semibold">{it.product_name}</div>
                    <div className="text-sm text-muted">{it.sku} · {it.cases} × {formatMoney(Number(it.case_price), order.currency)}</div>
                  </div>
                  <div className="font-bold">{formatMoney(Number(it.line_total), order.currency)}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Status</span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[order.status] ?? ""}`}>{order.status}</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-4">
            <span className="font-bold">Total</span>
            <span className="text-2xl font-extrabold">{formatMoney(Number(order.total), order.currency)}</span>
          </div>
          {order.notes ? <p className="rounded-xl bg-soft p-3 text-sm"><span className="font-semibold">Notes:</span> {order.notes}</p> : null}
          {order.status === "submitted" ? <CancelOrderButton orderId={order.id} /> : null}
          <Link href="/orders" className="block text-sm font-semibold text-brand underline">← All orders</Link>
        </aside>
      </div>
    </div>
  );
}
