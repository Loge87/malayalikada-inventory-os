import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { loadCatalogue, loadFacets, PAGE_SIZE, type Facet } from "@/lib/catalogue";
import { getPortalSettings, getPriceMode } from "@/lib/portal";

type SearchParams = Promise<{
  q?: string;
  category?: string;
  brand?: string;
  type?: string;
  stock?: string;
  new?: string;
  sort?: string;
  page?: string;
}>;

export const metadata = { title: "Products" };

const SORTS = [
  { value: "name", label: "A–Z" },
  { value: "newest", label: "Newest" },
  { value: "sku", label: "SKU" },
] as const;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [settings, mode, facets] = await Promise.all([getPortalSettings(), getPriceMode(), loadFacets()]);
  const page = Math.max(1, Number(params.page) || 1);
  const type = params.type === "frozen" || params.type === "dry" ? params.type : undefined;
  const inStock = params.stock === "1";
  const isNew = params.new === "1";
  const sort = SORTS.some((s) => s.value === params.sort) ? (params.sort as "name" | "newest" | "sku") : "name";

  const { items, total } = await loadCatalogue(
    { q: params.q, category: params.category, brand: params.brand, type, inStock, isNew, sort, page },
    settings,
    mode === "approved"
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const current: Record<string, string | undefined> = {
    q: params.q,
    category: params.category,
    brand: params.brand,
    type,
    stock: inStock ? "1" : undefined,
    new: isNew ? "1" : undefined,
    sort: sort === "name" ? undefined : sort,
  };
  /** Builds a /products link from the current filters with some overrides (page always resets). */
  const link = (over: Record<string, string | undefined> = {}) => {
    const sp = new URLSearchParams();
    const merged = { ...current, page: undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/products?${s}` : "/products";
  };

  const active: { label: string; href: string }[] = [];
  if (params.q) active.push({ label: `“${params.q}”`, href: link({ q: undefined }) });
  if (params.category) active.push({ label: params.category, href: link({ category: undefined }) });
  if (params.brand) active.push({ label: params.brand, href: link({ brand: undefined }) });
  if (type) active.push({ label: type === "frozen" ? "Frozen" : "Dry", href: link({ type: undefined }) });
  if (inStock) active.push({ label: "In stock", href: link({ stock: undefined }) });
  if (isNew) active.push({ label: "New arrivals", href: link({ new: undefined }) });
  const filtered = active.length > 0;

  const facetPanels = (
    <div className="space-y-7">
      <FacetList title="Category" items={facets.categories} active={params.category} href={(n) => link({ category: n })} clear={link({ category: undefined })} />
      <FacetList title="Brand" items={facets.brands} active={params.brand} href={(n) => link({ brand: n })} clear={link({ brand: undefined })} />
    </div>
  );

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

      <div className="container-page py-8">
        {/* Search + quick filters */}
        <div className="space-y-4">
          <form role="search" className="flex gap-2">
            {Object.entries(current).map(([k, v]) =>
              k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null
            )}
            <input className="input" name="q" defaultValue={params.q ?? ""} placeholder="Search by product, brand, category or SKU" />
            <button className="btn btn-primary" type="submit">Search</button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-bold uppercase tracking-widest text-muted">Quick filters</span>
            <Link href={link({ stock: inStock ? undefined : "1" })} className="fchip" data-active={inStock}>
              {inStock ? "✓ " : ""}In stock
            </Link>
            <Link href={link({ new: isNew ? undefined : "1" })} className="fchip" data-active={isNew}>
              {isNew ? "✓ " : ""}New arrivals
            </Link>
            {facets.types.frozen > 0 ? (
              <Link href={link({ type: type === "frozen" ? undefined : "frozen" })} className="fchip" data-active={type === "frozen"}>
                ❄️ Frozen <span className="opacity-60">{facets.types.frozen}</span>
              </Link>
            ) : null}
            {facets.types.dry > 0 ? (
              <Link href={link({ type: type === "dry" ? undefined : "dry" })} className="fchip" data-active={type === "dry"}>
                🌾 Dry <span className="opacity-60">{facets.types.dry}</span>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[16rem_1fr]">
          {/* Mobile: collapsible filters. Desktop: always-visible sidebar. */}
          <details className="card group p-4 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
              Category &amp; brand
              <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-4">{facetPanels}</div>
          </details>
          <aside className="hidden lg:sticky lg:top-28 lg:block lg:self-start">{facetPanels}</aside>

          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                <strong className="text-ink">{total}</strong> {total === 1 ? "product" : "products"}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted">Sort</span>
                <div className="inline-flex gap-1 rounded-full bg-soft p-1">
                  {SORTS.map((s) => (
                    <Link
                      key={s.value}
                      href={link({ sort: s.value === "name" ? undefined : s.value })}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold max-md:py-2 transition-all ${sort === s.value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {filtered ? (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {active.map((a) => (
                  <Link key={a.label} href={a.href} className="fchip" data-active="true" aria-label={`Remove filter ${a.label}`}>
                    {a.label} <span aria-hidden>×</span>
                  </Link>
                ))}
                <Link href="/products" className="ml-1 text-sm font-semibold text-brand underline">Clear all</Link>
              </div>
            ) : null}

            {items.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-4xl" aria-hidden>🔍</div>
                <p className="mt-3 font-semibold">
                  {filtered ? "No products match your filters." : "No products are available yet."}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {filtered ? "Try removing a filter or searching for something else." : "Please check back soon."}
                </p>
                {filtered ? <Link href="/products" className="btn btn-sm mt-5">Clear all filters</Link> : null}
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
  items: Facet[];
  active?: string;
  href: (name: string) => string;
  clear: string;
}) {
  if (items.length === 0) return null;
  return (
    <details open className="group">
      <summary className="mb-2 flex cursor-pointer list-none items-center justify-between text-xs font-bold uppercase tracking-widest text-ink">
        {title}
        <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <ul className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
        {active ? (
          <li><Link href={clear} className="px-3 text-sm font-semibold text-brand underline">All {title.toLowerCase() === "category" ? "categories" : "brands"}</Link></li>
        ) : null}
        {items.map((i) => (
          <li key={i.name}>
            <Link href={href(i.name)} className="facet-link" data-active={active === i.name}>
              <span className="truncate">{i.name}</span>
              <span className="text-muted">{i.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
