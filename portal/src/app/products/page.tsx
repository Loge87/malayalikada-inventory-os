import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { loadCatalogue, loadFacets, PAGE_SIZE } from "@/lib/catalogue";
import { getPortalSettings, getPriceMode } from "@/lib/portal";

type SearchParams = Promise<{ q?: string; category?: string; brand?: string; page?: string }>;

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [settings, mode, facets] = await Promise.all([getPortalSettings(), getPriceMode(), loadFacets()]);
  const page = Math.max(1, Number(params.page) || 1);

  const { items, total } = await loadCatalogue(
    { q: params.q, category: params.category, brand: params.brand, page },
    settings,
    mode === "approved"
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const link = (over: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q: params.q, category: params.category, brand: params.brand, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/products?${s}` : "/products";
  };
  const filtered = Boolean(params.q || params.category || params.brand);

  return (
    <>
      <section className="border-b border-line bg-soft">
        <div className="container-page anim-up py-12">
          <p className="eyebrow">Catalogue</p>
          <h1 className="section-title mt-3">Products</h1>
          <p className="mt-2 max-w-2xl text-muted">
            {mode === "approved" ? "Prices are per case. Each case holds the number of items shown." : settings.guestMessage}
          </p>
        </div>
      </section>

      <div className="container-page py-10">
        <div className="grid gap-10 lg:grid-cols-[16rem_1fr]">
          <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start">
            <form role="search" className="flex gap-2 lg:flex-col">
              {params.category ? <input type="hidden" name="category" value={params.category} /> : null}
              {params.brand ? <input type="hidden" name="brand" value={params.brand} /> : null}
              <input className="input" name="q" defaultValue={params.q ?? ""} placeholder="Search products or SKU" />
              <button className="btn btn-primary" type="submit">Search</button>
            </form>

            <FacetList title="Category" items={facets.categories} active={params.category} href={(n) => link({ category: n, page: undefined })} clear={link({ category: undefined, page: undefined })} />
            <FacetList title="Brand" items={facets.brands} active={params.brand} href={(n) => link({ brand: n, page: undefined })} clear={link({ brand: undefined, page: undefined })} />
            {filtered ? <Link className="btn w-full" href="/products">Clear all filters</Link> : null}
          </aside>

          <div>
            <p className="mb-5 text-sm text-muted">{total} {total === 1 ? "product" : "products"}</p>
            {items.length === 0 ? (
              <div className="card p-10 text-center text-muted">
                {filtered ? "No products match your filters." : "No products are available yet. Please check back soon."}
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">
                {items.map((item, i) => (
                  <li key={item.id} className="anim-up flex" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                    <ProductCard item={item} mode={mode} />
                  </li>
                ))}
              </ul>
            )}

            {pages > 1 ? (
              <nav className="mt-10 flex items-center justify-between" aria-label="Pages">
                {page > 1 ? <Link className="btn btn-sm" href={link({ page: String(page - 1) })}>← Previous</Link> : <span />}
                <span className="text-sm text-muted">Page {page} of {pages}</span>
                {page < pages ? <Link className="btn btn-sm" href={link({ page: String(page + 1) })}>Next →</Link> : <span />}
              </nav>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function FacetList({ title, items, active, href, clear }: {
  title: string;
  items: { name: string; count: number }[];
  active?: string;
  href: (name: string) => string;
  clear: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink">{title}</h2>
      <ul className="space-y-0.5">
        {active ? (
          <li><Link href={clear} className="text-sm font-semibold text-brand underline">All</Link></li>
        ) : null}
        {items.map((i) => (
          <li key={i.name}>
            <Link
              href={href(i.name)}
              className={`flex justify-between rounded-xl px-3 py-2 text-sm transition-colors hover:bg-soft ${active === i.name ? "bg-brand/10 font-bold text-brand" : ""}`}
            >
              <span>{i.name}</span>
              <span className="text-muted">{i.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
