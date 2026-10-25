import Link from "next/link";
import { redirect } from "next/navigation";

import { CartView } from "@/components/cart-view";
import { loadCartDetails } from "@/lib/cart-details";
import { getCurrentRetailer, getCurrentUser, getPortalSettings } from "@/lib/portal";

export const metadata = { title: "Your cart" };

export default async function CartPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/cart");

  const [settings, retailer] = await Promise.all([getPortalSettings(), getCurrentRetailer()]);

  return (
    <>
      <section className="border-b border-line bg-soft">
        <div className="container-page anim-up py-10">
          <p className="eyebrow">Checkout</p>
          <h1 className="section-title mt-3">Your cart</h1>
        </div>
      </section>
      <div className="container-page py-10">
        {!retailer || retailer.status !== "approved" ? (
          <div className="card mx-auto max-w-lg p-12 text-center">
            <div className="text-5xl" aria-hidden>⏳</div>
            <h2 className="mt-4 text-xl font-bold">
              {retailer?.status === "suspended" ? "Your account is on hold" : "Waiting for approval"}
            </h2>
            <p className="mt-1 text-muted">
              {retailer?.status === "suspended"
                ? "Please contact us to get ordering switched back on."
                : "Once we approve your account you can see prices and place orders."}
            </p>
            <Link href="/products" className="btn mt-6">Browse products</Link>
          </div>
        ) : (
          await CartContent({ settingsPromise: Promise.resolve(settings) })
        )}
      </div>
    </>
  );
}

async function CartContent({ settingsPromise }: { settingsPromise: Promise<Awaited<ReturnType<typeof getPortalSettings>>> }) {
  const settings = await settingsPromise;
  const cart = await loadCartDetails(settings);
  return (
    <CartView
      lines={cart.lines.map((l) => ({
        id: l.item.id,
        name: l.item.name,
        variantName: l.item.variantName,
        sku: l.item.sku,
        imageUrl: l.item.imageUrl,
        casePrice: l.item.casePrice,
        lineTotal: l.lineTotal,
        cases: l.cases,
        availableCases: l.availableCases,
        problem: l.problem,
      }))}
      subtotal={cart.subtotal}
      currency={cart.currency}
      minOrderValue={settings.minOrderValue}
      hasProblems={cart.hasProblems}
    />
  );
}
