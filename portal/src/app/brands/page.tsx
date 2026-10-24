import Link from "next/link";

import { loadFacets } from "@/lib/catalogue";

export const metadata = { title: "Brands" };

export default async function BrandsPage() {
  const { brands } = await loadFacets();
  const byLetter = new Map<string, typeof brands>();
  for (const b of brands) {
    const letter = /^[a-z]/i.test(b.name) ? b.name[0].toUpperCase() : "#";
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), b]);
  }

  return (
    <div className="container-page anim-up py-14">
      <p className="eyebrow">Shop by brand</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Brands</h1>
      {brands.length === 0 ? (
        <p className="mt-6 text-muted">No brands to show yet.</p>
      ) : (
        <div className="mt-8 space-y-6">
          {[...byLetter.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([letter, list]) => (
            <section key={letter} className="grid gap-3 sm:grid-cols-[3rem_1fr]">
              <h2 className="text-2xl font-extrabold text-brand">{letter}</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((b) => (
                  <li key={b.name}>
                    <Link href={`/products?brand=${encodeURIComponent(b.name)}`} className="card card-hover block px-5 py-4">
                      <div className="font-semibold">{b.name}</div>
                      <div className="text-xs text-muted">{b.count} {b.count === 1 ? "product" : "products"}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
