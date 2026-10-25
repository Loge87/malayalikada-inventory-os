import Link from "next/link";

import { brandGradient } from "@/lib/category-visual";
import { loadFacets } from "@/lib/catalogue";

export const metadata = { title: "Brands" };

export default async function BrandsPage() {
  const { brands } = await loadFacets();
  const byLetter = new Map<string, typeof brands>();
  for (const b of brands) {
    const letter = /^[a-z]/i.test(b.name) ? b.name[0].toUpperCase() : "#";
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), b]);
  }
  const letters = [...byLetter.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-soft">
        <div className="anim-drift pointer-events-none absolute -right-16 -top-20 size-80 rounded-full bg-brand/10 blur-3xl" aria-hidden />
        <div className="container-page anim-up relative py-14">
          <p className="eyebrow">Shop by brand</p>
          <h1 className="section-title mt-3">Brands</h1>
          <p className="mt-2 text-muted">{brands.length} brands stocked for trade.</p>
          {letters.length > 1 ? (
            <nav className="mt-6 flex flex-wrap gap-1.5" aria-label="Jump to letter">
              {letters.map((l) => (
                <a key={l} href={`#brand-${l}`} className="grid size-9 place-items-center rounded-xl border border-line bg-white text-sm font-bold transition-colors hover:border-brand hover:text-brand">
                  {l}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </section>

      <div className="container-page py-12">
        {brands.length === 0 ? (
          <p className="text-muted">No brands to show yet.</p>
        ) : (
          <div className="space-y-10">
            {letters.map((letter) => (
              <section key={letter} id={`brand-${letter}`} className="scroll-mt-28">
                <h2 className="mb-4 flex items-center gap-3 text-2xl font-extrabold text-brand">
                  {letter}<span className="h-px flex-1 bg-line" />
                </h2>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {byLetter.get(letter)!.map((b) => {
                    const [from, to] = brandGradient(b.name);
                    return (
                      <li key={b.name}>
                        <Link href={`/products?brand=${encodeURIComponent(b.name)}`} className="brand-tile w-full">
                          <span className="brand-mono" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
                            {b.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-bold">{b.name}</span>
                            <span className="text-xs text-muted">{b.count} {b.count === 1 ? "product" : "products"}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
