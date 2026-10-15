import Link from "next/link";

import { PriceRequestForm } from "@/components/price-request-form";
import { ProductCard, type PriceMode } from "@/components/product-card";
import { loadCatalogue, loadCategories, PAGE_SIZE } from "@/lib/catalogue";
import { getCurrentRetailer, getCurrentUser, getPortalSettings } from "@/lib/portal";

type SearchParams = Promise<{ q?: string; category?: string; page?: string }>;

export default async function CataloguePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [settings, user, retailer] = await Promise.all([
    getPortalSettings(),
    getCurrentUser(),
    getCurrentRetailer(),
  ]);

  if (!settings.isEnabled) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-bold">Ordering is paused</h1>
        <p className="mt-2 text-muted">Please check back soon, or contact us directly.</p>
      </div>
    );
  }

  const mode: PriceMode = !user || !retailer ? "guest" : retailer.status;
  const page = Math.max(1, Number(params.page) || 1);

  const [{ items, total }, categories] = await Promise.all([
    loadCatalogue({ q: params.q, category: params.category, page }, settings, mode === "approved"),
    loadCategories(),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.category) sp.set("category", params.category);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Wholesale catalogue</h1>
        <p className="mt-1 text-muted">
          {mode === "approved"
            ? "Prices are per case. Each case holds the number of items shown."
            : settings.guestMessage}
        </p>
      </section>

      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        <input className="input sm:max-w-sm" name="q" defaultValue={params.q ?? ""} placeholder="Search products or SKU" />
        <select className="input sm:max-w-xs" name="category" defaultValue={params.category ?? ""}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button className="btn btn-primary" type="submit">Search</button>
        {params.q || params.category ? <Link className="btn" href="/">Clear</Link> : null}
      </form>

      {items.length === 0 ? (
        <p className="text-muted">
          {total === 0 && !params.q && !params.category
            ? "No products are available yet. Please check back soon."
            : "No products match your search."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <ProductCard key={item.id} item={item} mode={mode} />
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-between" aria-label="Pages">
          {page > 1 ? <Link className="btn" href={link(page - 1)}>Previous</Link> : <span />}
          <span className="text-sm text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="btn" href={link(page + 1)}>Next</Link> : <span />}
        </nav>
      ) : null}

      {mode === "guest" ? (
        <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-xl font-bold">Want our price list?</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Leave your details and we will send it to you. Or{" "}
            <Link className="font-semibold text-brand underline" href="/signup">apply for a wholesale account</Link>{" "}
            to see prices and order online.
          </p>
          <PriceRequestForm />
        </section>
      ) : null}
    </div>
  );
}
