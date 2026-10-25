import Link from "next/link";

import { Reveal } from "@/components/reveal";
import { formatMoney } from "@/lib/catalogue";
import { getPortalSettings, getPriceMode } from "@/lib/portal";

export const metadata = { title: "For trade" };

export default async function TradePage() {
  const [settings, mode] = await Promise.all([getPortalSettings(), getPriceMode()]);
  const steps = [
    { n: "01", icon: "📝", title: "Apply", body: "Create an account with your business details and confirm your email." },
    { n: "02", icon: "✅", title: "Get approved", body: "We review every application by hand. Once approved you will see trade prices." },
    { n: "03", icon: "🛒", title: "Order by the case", body: `Add cases to your cart. The minimum order is ${formatMoney(settings.minOrderValue, settings.currency)}.` },
    { n: "04", icon: "🚚", title: "We confirm and deliver", body: "Stock is reserved when you place the order, and we confirm it with you." },
  ];
  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-soft">
        <div className="anim-drift pointer-events-none absolute -right-16 -top-20 size-80 rounded-full bg-brand/10 blur-3xl" aria-hidden />
        <div className="container-page anim-up relative py-14">
          <p className="eyebrow">For trade</p>
          <h1 className="section-title mt-3 max-w-2xl">How wholesale ordering works</h1>
          <p className="mt-2 max-w-xl text-muted">Four simple steps from application to delivery.</p>
        </div>
      </section>
      <div className="container-page py-14">
        <ol className="relative grid gap-5 md:grid-cols-2">
          {steps.map((s, i) => (
            <Reveal as="li" key={s.n} delay={i * 90}>
              <div className="card card-hover relative h-full overflow-hidden p-7">
                <span className="absolute -right-2 -top-4 select-none text-[6rem] font-black leading-none text-brand/[0.06]">{s.n}</span>
                <div className="grid size-12 place-items-center rounded-2xl bg-brand/10 text-2xl">{s.icon}</div>
                <h2 className="mt-5 text-lg font-bold">{s.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap gap-3">
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
    </>
  );
}
