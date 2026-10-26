import Link from "next/link";
import { redirect } from "next/navigation";

import { BulkOrder } from "@/components/bulk-order";
import { getCurrentRetailer, getCurrentUser } from "@/lib/portal";

export const metadata = { title: "Quick order" };

export default async function BulkOrderPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/quick-order");
  const retailer = await getCurrentRetailer();
  const approved = retailer?.status === "approved";

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-soft">
        <div className="anim-drift pointer-events-none absolute -right-16 -top-20 size-80 rounded-full bg-brand/10 blur-3xl" aria-hidden />
        <div className="container-page anim-up relative py-12">
          <p className="eyebrow">Fast ordering</p>
          <h1 className="section-title mt-3">Quick order</h1>
          <p className="mt-2 max-w-xl text-muted">
            Upload a spreadsheet of SKUs and cases. We check stock for every line, then you pick what to add to your cart.
          </p>
        </div>
      </section>
      <div className="container-page py-10">
        {approved ? (
          <BulkOrder />
        ) : (
          <div className="card mx-auto max-w-lg p-12 text-center">
            <div className="text-5xl" aria-hidden>⏳</div>
            <h2 className="mt-4 text-xl font-bold">Available once you are approved</h2>
            <p className="mt-1 text-muted">Quick order opens as soon as we approve your wholesale account.</p>
            <Link href="/products" className="btn mt-6">Browse products</Link>
          </div>
        )}
      </div>
    </>
  );
}
