import Link from "next/link";

import { getPortalSettings, getPriceMode } from "@/lib/portal";
import { formatMoney } from "@/lib/catalogue";

export const metadata = { title: "For trade" };

export default async function TradePage() {
  const [settings, mode] = await Promise.all([getPortalSettings(), getPriceMode()]);
  const steps = [
    { n: "01", title: "Apply", body: "Create an account with your business details and confirm your email." },
    { n: "02", title: "Get approved", body: "We review every application by hand. Once approved you will see trade prices." },
    { n: "03", title: "Order by the case", body: `Add cases to your order. The minimum order is ${formatMoney(settings.minOrderValue, settings.currency)}.` },
    { n: "04", title: "We confirm and deliver", body: "Stock is reserved when you place the order, and we confirm it with you." },
  ];
  return (
    <div className="container-page anim-up py-14">
      <p className="eyebrow">For trade</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">How wholesale ordering works</h1>
      <ol className="mt-8 grid gap-4 md:grid-cols-2">
        {steps.map((s) => (
          <li key={s.n} className="card card-hover p-7">
            <div className="text-sm font-bold text-brand">{s.n}</div>
            <h2 className="mt-2 text-lg font-bold">{s.title}</h2>
            <p className="mt-1 text-sm text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap gap-3">
        {mode === "guest" ? (
          <>
            <Link href="/signup" className="btn btn-primary">Apply for an account</Link>
            <Link href="/login" className="btn">Sign in</Link>
          </>
        ) : (
          <Link href="/products" className="btn btn-primary">Browse products</Link>
        )}
      </div>
    </div>
  );
}
