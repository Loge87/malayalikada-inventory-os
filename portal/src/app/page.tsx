import Link from "next/link";

import { ProductCard, ProductImage } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { loadCatalogue, loadFacets } from "@/lib/catalogue";
import { getPortalSettings, getPriceMode } from "@/lib/portal";
import { SITE } from "@/lib/site";

const WHY = [
  { icon: "✓", title: "Approved retailers only", body: "Every retailer is reviewed by hand, so you trade with a known network." },
  { icon: "▦", title: "Priced by the case", body: "See your trade price per case, with the case size on every product." },
  { icon: "◔", title: "Live stock", body: "Stock is checked when you order, so you know what is available before you commit." },
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

  const byLetter = new Map<string, string[]>();
  for (const b of facets.brands) {
    const letter = /^[a-z]/i.test(b.name) ? b.name[0].toUpperCase() : "#";
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), b.name]);
  }
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

          {/* Product collage built from real products */}
          <div className="anim-up relative [animation-delay:200ms]" aria-hidden>
            <div className="grid grid-cols-2 gap-4">
              {(collage.length > 0 ? collage : [null, null, null, null]).map((f, i) => (
                <div
                  key={f?.id ?? i}
                  className={`card product-media aspect-square overflow-hidden shadow-[var(--shadow-md)] ${i % 2 === 1 ? "mt-8" : ""} ${i % 2 === 0 ? "anim-float" : "anim-float [animation-delay:-3s]"}`}
                >
                  <ProductImage src={f?.imageUrl ?? null} alt="" />
                </div>
              ))}
            </div>
            <div className="card absolute -bottom-6 left-1/2 w-[85%] -translate-x-1/2 bg-white/95 p-4 shadow-[var(--shadow-lg)] backdrop-blur sm:left-4 sm:w-64 sm:translate-x-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Quick order</span>
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">By the case</span>
              </div>
              <div className="mt-2 text-xs text-muted">Add cases in seconds, see stock as you go.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="container-page py-20">
        <Reveal>
          <p className="eyebrow">Why order with us</p>
          <h2 className="section-title mt-3 max-w-xl">Built for retailers who order in bulk</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {WHY.map((w, i) => (
            <Reveal key={w.title} delay={i * 100}>
              <div className="card card-hover h-full p-7">
                <div className="grid size-12 place-items-center rounded-2xl bg-brand/10 text-xl font-bold text-brand">{w.icon}</div>
                <h3 className="mt-5 text-lg font-bold">{w.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{w.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
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
              <h2 className="section-title mt-3">Categories</h2>
            </div>
            <Link href="/categories" className="btn btn-sm">All categories →</Link>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {facets.categories.slice(0, 8).map((c, i) => (
              <Reveal key={c.name} delay={(i % 4) * 80}>
                <Link href={`/products?category=${encodeURIComponent(c.name)}`} className="card card-hover relative block h-full p-6">
                  {c.name === topCategory ? (
                    <span className="absolute right-4 top-4 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-[#a15f06]">Popular</span>
                  ) : null}
                  <div className="grid size-11 place-items-center rounded-xl bg-soft text-lg font-extrabold text-brand">
                    {c.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="mt-4 font-bold">{c.name}</div>
                  <div className="text-sm text-muted">{c.count} {c.count === 1 ? "product" : "products"}</div>
                </Link>
              </Reveal>
            ))}
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
              </div>
              <Link href="/brands" className="btn btn-sm">All brands →</Link>
            </Reveal>
            <div className="mt-10 space-y-6">
              {[...byLetter.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 6).map(([letter, names]) => (
                <Reveal key={letter}>
                  <div className="grid gap-3 sm:grid-cols-[3rem_1fr]">
                    <div className="text-2xl font-extrabold text-brand">{letter}</div>
                    <div className="flex flex-wrap gap-2.5">
                      {names.map((n) => (
                        <Link key={n} href={`/products?brand=${encodeURIComponent(n)}`} className="chip">
                          {n}
                        </Link>
                      ))}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Trade ordering */}
      <section className="container-page py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-brand px-8 py-14 text-brand-ink sm:px-14">
            <div className="anim-drift pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="relative grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">Trade ordering</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Order online, any time</h2>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {[
                    "Prices shown per case once you are approved",
                    "Quick order grid for fast bulk entry",
                    "Live stock checks before you place an order",
                    "Order history in your account",
                  ].map((t) => (
                    <li key={t} className="flex gap-2.5"><span className="font-bold">✓</span>{t}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                {mode === "guest" ? (
                  <>
                    <Link href="/login" className="btn border-white bg-white text-brand hover:text-brand-dark">Sign in</Link>
                    <Link href="/signup" className="btn border-white/60 bg-transparent text-white hover:border-white hover:text-white">Apply for an account</Link>
                  </>
                ) : (
                  <Link href="/products" className="btn border-white bg-white text-brand hover:text-brand-dark">Start an order</Link>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
