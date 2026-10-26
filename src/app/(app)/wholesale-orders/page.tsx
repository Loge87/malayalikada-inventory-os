import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ORDER_FILTERS, ORDER_STATUS_LABEL, ORDER_STATUS_STYLE, type OrderStatus } from "./status";

type Filter = (typeof ORDER_FILTERS)[number]["value"];

export default async function WholesaleOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "wholesale:manage")) redirect("/dashboard");

  const { status } = await searchParams;
  const filter: Filter = ORDER_FILTERS.some((f) => f.value === status) ? (status as Filter) : "open";

  let query = supabase
    .from("portal_orders")
    .select("id, order_number, status, currency, total, seen_at, placed_at, retailers(business_name)")
    .order("placed_at", { ascending: false })
    .limit(200);
  if (filter === "open") query = query.in("status", ["submitted", "approved", "picked", "dispatched"]);
  else if (filter !== "all") query = query.eq("status", filter);
  const { data, error } = await query;
  if (error) throw error;

  const { count: newCount } = await supabase
    .from("portal_orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted");

  const rows = (data ?? []).map((o) => {
    const r = Array.isArray(o.retailers) ? o.retailers[0] : o.retailers;
    return {
      id: o.id as string,
      number: Number(o.order_number),
      status: o.status as OrderStatus,
      currency: o.currency as string,
      total: Number(o.total),
      unseen: o.seen_at === null,
      placedAt: o.placed_at as string,
      retailer: (r as { business_name?: string } | null)?.business_name ?? "Unknown retailer",
    };
  });

  return (
    <div className="flex w-full flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Wholesale orders</h1>
        <p className="text-page-subtitle">
          Orders placed by retailers in your wholesale portal. Stock is reserved when an order
          is placed — approve it, then pick and dispatch.
          {newCount ? ` ${newCount} new ${newCount === 1 ? "order is" : "orders are"} waiting for approval.` : ""}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ORDER_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "open" ? "/wholesale-orders" : `/wholesale-orders?status=${f.value}`}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
              filter === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted"
            )}
          >
            {f.label}
            {f.value === "submitted" && newCount ? (
              <span className="ml-1.5 rounded-full bg-status-warning/20 px-1.5 text-xs">{newCount}</span>
            ) : null}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No orders here yet.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {rows.map((o) => (
            <li key={o.id}>
              <Link
                href={`/wholesale-orders/${o.id}`}
                className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {o.unseen ? <span className="size-2 shrink-0 rounded-full bg-status-warning" aria-label="Not opened yet" /> : null}
                    <span className="font-semibold">#{o.number}</span>
                    <span className="truncate text-muted-foreground">· {o.retailer}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(o.placedAt)}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-4">
                  <span className="font-semibold tabular-nums">{formatMoney(o.total, o.currency)}</span>
                  <span
                    className={cn(
                      "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                      ORDER_STATUS_STYLE[o.status]
                    )}
                  >
                    {ORDER_STATUS_LABEL[o.status]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
