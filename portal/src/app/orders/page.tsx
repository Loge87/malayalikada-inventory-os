import Link from "next/link";
import { redirect } from "next/navigation";

import { formatMoney } from "@/lib/catalogue";
import { STATUS_STYLE } from "@/lib/order-status";
import { getCurrentRetailer, getCurrentUser, getOrganisationId } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "My orders" };

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/orders");
  const retailer = await getCurrentRetailer();

  const admin = createAdminClient();
  const { data } = retailer
    ? await admin
        .from("portal_orders")
        .select("id, order_number, status, currency, total, placed_at")
        .eq("organisation_id", getOrganisationId())
        .eq("retailer_id", retailer.id)
        .order("placed_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const orders = data ?? [];

  return (
    <>
      <section className="border-b border-line bg-soft">
        <div className="container-page anim-up py-10">
          <p className="eyebrow">Account</p>
          <h1 className="section-title mt-3">My orders</h1>
        </div>
      </section>
      <div className="container-page py-10">
        {orders.length === 0 ? (
          <div className="card mx-auto max-w-lg p-12 text-center">
            <div className="text-5xl" aria-hidden>📦</div>
            <h2 className="mt-4 text-xl font-bold">No orders yet</h2>
            <p className="mt-1 text-muted">Your orders will appear here.</p>
            <Link href="/products" className="btn btn-primary mt-6">Browse products</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="card card-hover flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <div className="font-bold">Order #{o.order_number}</div>
                    <div className="text-sm text-muted">{new Date(o.placed_at).toLocaleDateString("en-NZ", { dateStyle: "medium" })}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[o.status] ?? ""}`}>{o.status}</span>
                  <div className="text-lg font-extrabold">{formatMoney(Number(o.total), o.currency)}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
