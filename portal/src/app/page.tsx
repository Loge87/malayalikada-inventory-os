import Link from "next/link";

import { ProductCard, ProductImage } from "@/components/product-card";
import { loadCatalogue, loadFacets } from "@/lib/catalogue";
import { getPortalSettings, getPriceMode } from "@/lib/portal";
import { SITE } from "@/lib/site";

const WHY = [
  { n: "01", title: "Approved retailers only", body: "Every retailer is reviewed by hand, so you trade with a known network." },
  { n: "02", title: "Priced by the case", body: "See your trade price per case, with the case size on every product." },
  { n: "03", title: "Live stock", body: "Stock is checked when you order, so you know what is available before you commit." },
];

export default async function HomePage() {
  const [settings, mode, facets] = await Promise.all([getPortalSettings(), getPriceMode(), loadFacets()]);

  if (!settings.isEnabled) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-bold">Ordering is paused</h1>
        <p className="mt-2 text-muted">Please check back soon, or contact us directly.</p>
      </div>
    );
  }

  const { items: featured } = await loadCatalogue({ pageSize: 8, sort: "newest" }, settings, mode === "approved");

  // group brands by first letter
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

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line bg-[#f3efe4]">
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="eyebrow">{SITE.region} · Trade only</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              {SITE.tagline}.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted">{SITE.intro}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/products" className="btn btn-primary">Browse products</Link>
              {mode === "guest" ? <Link href="/signup" className="btn">Apply for an account</Link> : null}
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
              {stats.map((s) => (
                <div key={s.label}>
                  <dd className="text-3xl font-extrabold tracking-tight text-brand">{s.value}</dd>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-muted">{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* Order list preview built from real products */}
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5" aria-hidden>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold">Quick order</span>
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">By the case</span>
            </div>
            <ul className="divide-y divide-line">
              {featured.slice(0, 4).map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-2.5">
                  <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-[#efeadc]">
                    <ProductImage src={f.imageUrl} alt="" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{f.name}</div>
                    <div className="text-xs text-muted">Case of {f.unitsPerCase}</div>
                  </div>
                  <div className="rounded-md border border-line px-3 py-1 text-sm">1</div>
                </li>
              ))}
              {featured.length === 0 ? <li className="py-6 text-center text-sm text-muted">Products appear here soon.</li> : null}
            </ul>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="container-page py-16">
        <p className="eyebrow">Why order with us</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Built for retailers who order in bulk</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {WHY.map((w) => (
            <div key={w.n} className="rounded-2xl border border-line bg-surface p-6">
              <div className="text-sm font-bold text-accent">{w.n}</div>
              <h3 className="mt-2 text-lg font-bold">{w.title}</h3>
              <p className="mt-1 text-sm text-muted">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Brands */}
      {facets.brands.length > 0 ? (
        <section className="border-y border-line bg-surface py-16">
          <div className="container-page">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Shop by brand</p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Our brands</h2>
              </div>
              <Link href="/brands" className="text-sm font-semibold text-brand underline">All brands</Link>
            </div>
            <div className="mt-8 space-y-6">
              {[...byLetter.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 6).map(([letter, names]) => (
                <div key={letter} className="grid gap-3 sm:grid-cols-[3rem_1fr]">
                  <div className="text-2xl font-extrabold text-accent">{letter}</div>
                  <div className="flex flex-wrap gap-2">
                    {names.map((n) => (
                      <Link key={n} href={`/products?brand=${encodeURIComponent(n)}`} className="rounded-xl border border-line bg-bg px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand">
                        {n}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Categories */}
      {facets.categories.length > 0 ? (
        <section className="container-page py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Shop the pantry</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Categories</h2>
            </div>
            <Link href="/categories" className="text-sm font-semibold text-brand underline">All categories</Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {facets.categories.slice(0, 8).map((c) => (
              <Link key={c.name} href={`/products?category=${encodeURIComponent(c.name)}`} className="relative rounded-2xl border border-line bg-surface p-5 transition hover:border-brand hover:shadow-md">
                {c.name === topCategory ? (
                  <span className="absolute right-3 top-3 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">Popular</span>
                ) : null}
                <div className="font-bold">{c.name}</div>
                <div className="text-sm text-muted">{c.count} {c.count === 1 ? "product" : "products"}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Featured */}
      {featured.length > 0 ? (
        <section className="container-page pb-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Just added</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight">New products</h2>
            </div>
            <Link href="/products" className="text-sm font-semibold text-brand underline">Browse all</Link>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((item) => (
              <ProductCard key={item.id} item={item} mode={mode} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* Trade ordering */}
      <section className="bg-brand text-brand-ink">
        <div className="container-page grid gap-8 py-14 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-80">Trade ordering</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Order online, any time</h2>
            <ul className="mt-5 space-y-2 text-sm opacity-95">
              <li>Prices shown per case once you are approved</li>
              <li>Quick order grid for fast bulk entry</li>
              <li>Live stock checks before you place an order</li>
              <li>Order history in your account</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            {mode === "guest" ? (
              <>
                <Link href="/login" className="btn border-white bg-white text-brand">Sign in</Link>
                <Link href="/signup" className="btn border-white/60 bg-transparent text-white hover:border-white">Apply for an account</Link>
              </>
            ) : (
              <Link href="/products" className="btn border-white bg-white text-brand">Start an order</Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
