import Link from "next/link";

import { BrandMarquee } from "@/components/brand-marquee";
import {
  CasePriceIllustration,
  LiveStockIllustration,
  OrderTrackingIllustration,
  QuickOrderIllustration,
  TONES,
} from "@/components/illustrations";
import { ProductCard, ProductImage } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { loadCatalogue, loadFacets } from "@/lib/catalogue";
import { categoryVisual } from "@/lib/category-visual";
import { formatMoney } from "@/lib/money";
import { getPortalSettings, getPriceMode } from "@/lib/portal";
import { SITE } from "@/lib/site";

const WHY = [
  {
    art: <CasePriceIllustration />,
    tone: TONES.green,
    title: "Trade prices, by the case",
    body: "Your wholesale price per case, with the case size on every product, so you can plan your margin at a glance.",
    points: ["Prices shown to approved retailers only", "No guesswork on units per case"],
  },
  {
    art: <LiveStockIllustration />,
    tone: TONES.teal,
    title: "Live stock you can trust",
    body: "See exactly how many cases are available, and your order is reserved the moment you place it.",
    points: ["Cases available shown on every product", "Stock held for you once ordered"],
  },
  {
    art: <QuickOrderIllustration />,
    tone: TONES.violet,
    title: "Reorder in seconds",
    body: "Upload your usual list as an Excel or CSV file and add the whole lot to your cart in one go.",
    points: ["Spreadsheet quick order", "Stock status checked line by line"],
  },
  {
    art: <OrderTrackingIllustration />,
    tone: TONES.amber,
    title: "Every order in one place",
    body: "Follow each order from placed to ready, and cancel it before we confirm if your plans change.",
    points: ["Full order history and status", "Cancel any time before it is confirmed"],
  },
];

const STEPS = [
  {
    tone: TONES.green,
    title: "Apply",
    body: "Create your free trade account with your business details.",
    icon: <><path d="M4 20v-1a5 5 0 0 1 5-5h2" /><circle cx="10" cy="8" r="3.5" /><path d="M17 14v6M14 17h6" /></>,
  },
  {
    tone: TONES.teal,
    title: "Get approved",
    body: "We review every account by hand so the network stays trusted.",
    icon: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  },
  {
    tone: TONES.violet,
    title: "See trade prices",
    body: "Prices per case unlock as soon as you are approved.",
    icon: <><path d="M3 12.5V4h8.5L21 13.5 13.5 21z" /><circle cx="7.5" cy="8.5" r="1.3" /></>,
  },
  {
    tone: TONES.amber,
    title: "Order by the case",
    body: "Add cases, or upload a list, and your stock is held at once.",
    icon: <><path d="M3 4h2l2.4 10h10l2-7H6.5" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
  },
];

const FAQ = (min: number, currency: string) => [
  { q: "Who can order?", a: "The portal is for trade customers only: retailers, grocers and food businesses. Apply for an account and we will approve it after a quick review." },
  { q: "When do I see prices?", a: "Trade prices are shown once your account is approved. Until then you can browse the full range and see what is in stock." },
  { q: "What is a case?", a: "Everything is ordered by the case. The case size is shown on each product, and one unit in your cart is one case." },
  { q: "Is there a minimum order?", a: `Yes, the minimum order is ${formatMoney(min, currency)}. Your cart shows how far you are from it.` },
  { q: "Is my stock held when I order?", a: "Yes. Your cases are reserved the moment you place the order, so they cannot be sold to someone else." },
  { q: "Can I cancel an order?", a: "You can cancel from your order page while it is still waiting for confirmation, and the reserved stock is released." },
];

export default async function HomePage() {
  const [settings, mode, facets] = await Promise.all([getPortalSettings(), getPriceMode(), loadFacets()]);

  if (!settings.isEnabled) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="text-2xl font-bold">Ordering is paused</h1>
        <p className="mt-2 text-muted">Please check back soon, or contact us directly.</p>
      </div>
    );
  }

  const { items: featured } = await loadCatalogue({ pageSize: 8, sort: "newest" }, settings, mode === "approved");

  const topCategory = [...facets.categories].sort((a, b) => b.count - a.count)[0]?.name;
  const stats = [
    { value: facets.brands.length, label: "Brands" },
    { value: facets.total, label: "Products" },
    { value: facets.categories.length, label: "Categories" },
  ];
  const collage = featured.slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        <div className="anim-drift pointer-events-none absolute -left-24 -top-24 size-[28rem] rounded-full bg-brand/10 blur-3xl" aria-hidden />
        <div className="anim-drift pointer-events-none absolute -right-20 top-10 size-[24rem] rounded-full bg-accent/15 blur-3xl [animation-delay:-6s]" aria-hidden />

        <div className="container-page relative grid items-center gap-14 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <p className="eyebrow anim-up">{SITE.region} · Trade only</p>
            <h1 className="anim-up mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight [animation-delay:80ms] sm:text-6xl">
              {SITE.tagline}<span className="text-brand">.</span>
            </h1>
            <p className="anim-up mt-5 max-w-lg text-lg leading-relaxed text-muted [animation-delay:160ms]">{SITE.intro}</p>
            <div className="anim-up mt-8 flex flex-wrap gap-3 [animation-delay:240ms]">
              <Link href="/products" className="btn btn-primary">Browse products</Link>
              {mode === "guest" ? <Link href="/signup" className="btn">Apply for an account</Link> : null}
            </div>
            <dl className="anim-up mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-8 [animation-delay:320ms]">
              {stats.map((s) => (
                <div key={s.label}>
                  <dd className="text-3xl font-extrabold tracking-tight">{s.value}</dd>
                  <dt className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted">{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* Product showcase built from real products */}
          <div className="anim-up relative mx-auto w-full max-w-xl [animation-delay:200ms]">
            <div className="pointer-events-none absolute inset-0 -z-0 rounded-[2.5rem] bg-gradient-to-br from-soft via-white to-soft ring-1 ring-line" aria-hidden />
            <div className="relative grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-5">
              {[0, 1].map((col) => (
                <div key={col} className={`flex flex-col gap-3 sm:gap-4 ${col === 1 ? "pt-8 sm:pt-12" : ""}`}>
                  {(collage.length > 0 ? collage : [null, null, null, null])
                    .slice(0, 4)
                    .map((f, i) => ({ f, i }))
                    .filter(({ i }) => i % 2 === col)
                    .map(({ f, i }, k) => {
                      const tone = [TONES.amber, TONES.teal, TONES.violet, TONES.green][i % 4];
                      return (
                        <figure
                          key={f?.id ?? i}
                          className={`hero-tile group relative overflow-hidden rounded-[1.75rem] ring-1 ring-black/5 shadow-[0_22px_44px_-24px_rgb(15_26_20/0.45)] transition-transform duration-500 hover:-translate-y-1 ${
                            k === 0 ? "aspect-[4/5]" : "aspect-square"
                          } ${i % 2 === 0 ? "anim-float" : "anim-float [animation-delay:-3s]"}`}
                          style={{ background: `radial-gradient(120% 90% at 50% 25%, #fff 0%, ${tone.tint} 100%)` }}
                        >
                          <div className="h-full w-full pb-14 transition-transform duration-700 ease-out group-hover:scale-105 [&_img]:drop-shadow-[0_14px_16px_rgb(15_26_20/0.18)]">
                            <ProductImage src={f?.imageUrl ?? null} alt="" />
                          </div>
                          {f ? (
                            <figcaption className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2 rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-white/70 backdrop-blur-md">
                              <div className="min-w-0">
                                {f.brand ? <div className="truncate text-[10px] font-bold uppercase tracking-widest" style={{ color: tone.c2 }}>{f.brand}</div> : null}
                                <div className="truncate text-xs font-semibold">{f.name}</div>
                              </div>
                              <span className="grid size-7 shrink-0 place-items-center rounded-full text-white" style={{ background: `linear-gradient(135deg, ${tone.c1}, ${tone.c2})` }} aria-hidden>
                                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
                              </span>
                            </figcaption>
                          ) : null}
                          {i === 0 ? (
                            <span className="absolute left-3 top-3 rounded-full bg-ink/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur">New in</span>
                          ) : null}
                        </figure>
                      );
                    })}
                </div>
              ))}
            </div>
            <div className="absolute -bottom-5 right-3 flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow-[var(--shadow-lg)] ring-1 ring-line backdrop-blur-md sm:-right-2">
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-[#0b3d22] text-white" aria-hidden>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2l2.4 10h10l2-7H6.5" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></svg>
              </span>
              <div>
                <div className="text-sm font-bold leading-tight">Quick order</div>
                <div className="text-xs text-muted">Add cases in seconds</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="relative overflow-hidden py-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[60rem] -translate-x-1/2 rounded-full bg-brand/5 blur-3xl" aria-hidden />
        <div className="container-page relative">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Why order with us</p>
            <h2 className="section-title mt-3">Built for retailers who order in bulk</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              A trusted trade network with clear case pricing, live stock, fast reordering and order tracking, all in one place.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map((w, i) => (
              <Reveal key={w.title} delay={i * 120}>
                <div className="card card-hover value-card h-full overflow-hidden">
                  <div className="relative aspect-[22/15] px-5 pt-5" style={{ background: `linear-gradient(160deg, ${w.tone.tint}, #fff 85%)` }}>
                    <div className="value-art h-full w-full">{w.art}</div>
                  </div>
                  <div className="p-7 pt-5">
                    <div className="flex items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-full text-xs font-extrabold text-white" style={{ background: `linear-gradient(135deg, ${w.tone.c1}, ${w.tone.c2})` }}>{i + 1}</span>
                      <h3 className="text-lg font-bold">{w.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{w.body}</p>
                    <ul className="mt-4 space-y-1.5 text-sm">
                      {w.points.map((pt) => (
                        <li key={pt} className="flex gap-2"><span className="font-bold" style={{ color: w.tone.c2 }}>✓</span><span>{pt}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-page pb-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">How it works</p>
          <h2 className="section-title mt-3">From sign-up to delivery in four steps</h2>
        </Reveal>
        <ol className="relative mt-14 grid gap-5 md:grid-cols-4">
          <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-8 hidden h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent md:block" aria-hidden />
          {STEPS.map((st, i) => (
            <Reveal as="li" key={st.title} delay={i * 100} className="relative">
              <div className="card h-full p-6 text-center">
                <div
                  className="mx-auto grid size-16 place-items-center rounded-2xl text-white shadow-[0_14px_28px_-10px_var(--shadow-c)]"
                  style={{ background: `linear-gradient(135deg, ${st.tone.c1}, ${st.tone.c2})`, "--shadow-c": st.tone.c2 } as React.CSSProperties}
                  aria-hidden
                >
                  <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{st.icon}</svg>
                </div>
                <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: st.tone.c2 }}>Step {i + 1}</div>
                <h3 className="mt-1 text-lg font-bold">{st.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{st.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Featured */}
      {featured.length > 0 ? (
        <section className="bg-soft py-20">
          <div className="container-page">
            <Reveal className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Just added</p>
                <h2 className="section-title mt-3">New products</h2>
              </div>
              <Link href="/products" className="btn btn-sm">Browse all →</Link>
            </Reveal>
            <ul className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {featured.map((item, i) => (
                <Reveal as="li" key={item.id} delay={(i % 4) * 90} className="flex">
                  <ProductCard item={item} mode={mode} />
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Categories */}
      {facets.categories.length > 0 ? (
        <section className="container-page py-20">
          <Reveal className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Shop the pantry</p>
              <h2 className="section-title mt-3">Browse by category</h2>
            </div>
            <Link href="/categories" className="btn btn-sm">All categories →</Link>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            {facets.categories.slice(0, 8).map((c, i) => {
              const v = categoryVisual(c.name);
              return (
                <Reveal key={c.name} delay={(i % 4) * 80}>
                  <Link
                    href={`/products?category=${encodeURIComponent(c.name)}`}
                    className="cat-card h-full"
                    style={{ "--from": v.from, "--to": v.to } as React.CSSProperties}
                  >
                    <span className="cat-emoji" aria-hidden>{v.emoji}</span>
                    {c.name === topCategory ? (
                      <span className="mb-2 w-fit rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-bold text-[#a15f06] backdrop-blur">★ Popular</span>
                    ) : null}
                    <div className="text-lg font-extrabold leading-tight tracking-tight">{c.name}</div>
                    <div className="text-sm text-ink/60">{c.count} {c.count === 1 ? "product" : "products"}</div>
                    <span className="cat-arrow" aria-hidden>→</span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Brands */}
      {facets.brands.length > 0 ? (
        <section className="border-y border-line bg-soft py-20">
          <div className="container-page">
            <Reveal className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Shop by brand</p>
                <h2 className="section-title mt-3">Our brands</h2>
                <p className="mt-2 text-muted">{facets.brands.length} {facets.brands.length === 1 ? "brand" : "brands"} you can order today. Hover to pause.</p>
              </div>
              <Link href="/brands" className="btn btn-sm">All brands →</Link>
            </Reveal>
          </div>
          <Reveal className="mt-10 space-y-4">
            <BrandMarquee brands={facets.brands} />
            {facets.brands.length >= 8 ? (
              <BrandMarquee brands={[...facets.brands].reverse()} reverse />
            ) : null}
          </Reveal>
        </section>
      ) : null}

      {/* FAQ */}
      <section className="container-page py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <Reveal>
            <p className="eyebrow">Good to know</p>
            <h2 className="section-title mt-3">Questions, answered</h2>
            <p className="mt-4 max-w-sm text-muted">The basics of trading with us. Anything else, get in touch and we will help.</p>
            <Link href="/contact" className="btn btn-sm mt-6">Contact us →</Link>
          </Reveal>
          <Reveal delay={100} className="space-y-3">
            {FAQ(settings.minOrderValue, settings.currency).map((q) => (
              <details key={q.q} className="faq card group px-5 py-4 open:shadow-[var(--shadow-md)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {q.q}
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/10 text-brand transition-transform duration-300 group-open:rotate-45" aria-hidden>
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{q.a}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Trade ordering */}
      <section className="container-page py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-[#0f4f2c] via-brand to-[#2a9a5b] p-8 text-brand-ink sm:p-14">
            <div className="anim-drift pointer-events-none absolute -right-20 -top-24 size-96 rounded-full bg-white/10 blur-3xl" aria-hidden />
            <div className="anim-drift pointer-events-none absolute -bottom-28 left-1/4 size-80 rounded-full bg-accent/25 blur-3xl [animation-delay:-7s]" aria-hidden />
            <div className="relative grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.16em] backdrop-blur">
                  <span className="relative flex size-2"><span className="anim-ping absolute inline-flex size-full rounded-full bg-white/70" /><span className="relative inline-flex size-2 rounded-full bg-white" /></span>
                  Open 24/7
                </span>
                <h2 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">Order online, any time</h2>
                <p className="mt-4 max-w-md text-lg leading-relaxed opacity-90">
                  Stock up whenever suits you. Pick your cases, see live availability and place your order in minutes.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {mode === "guest" ? (
                    <>
                      <Link href="/login" className="btn border-white bg-white text-brand hover:text-brand-dark">Sign in</Link>
                      <Link href="/signup" className="btn border-white/60 bg-transparent text-white hover:border-white hover:text-white">Apply for an account</Link>
                    </>
                  ) : (
                    <Link href="/products" className="btn border-white bg-white text-brand hover:text-brand-dark">Start an order →</Link>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur sm:p-8">
                <div className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">Your trade terms</div>
                <dl className="mt-5 divide-y divide-white/15">
                  {[
                    { k: "Minimum order", v: formatMoney(settings.minOrderValue, settings.currency) },
                    { k: "Ordering unit", v: "1 case" },
                    { k: "Stock", v: "Held on order" },
                    { k: "Ordering", v: "Open 24/7" },
                  ].map((t) => (
                    <div key={t.k} className="flex items-baseline justify-between gap-4 py-3.5">
                      <dt className="text-sm opacity-80">{t.k}</dt>
                      <dd className="text-xl font-extrabold tracking-tight">{t.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
