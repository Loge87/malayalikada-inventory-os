import Link from "next/link";

import { categoryVisual } from "@/lib/category-visual";
import { loadFacets } from "@/lib/catalogue";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { categories } = await loadFacets();
  const top = [...categories].sort((a, b) => b.count - a.count)[0]?.name;

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-soft">
        <div className="anim-drift pointer-events-none absolute -left-16 -top-20 size-80 rounded-full bg-accent/15 blur-3xl" aria-hidden />
        <div className="container-page anim-up relative py-14">
          <p className="eyebrow">Shop the pantry</p>
          <h1 className="section-title mt-3">Categories</h1>
          <p className="mt-2 text-muted">{categories.length} categories to browse.</p>
        </div>
      </section>
      <div className="container-page py-12">
        {categories.length === 0 ? (
          <p className="text-muted">No categories to show yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c, i) => {
              const v = categoryVisual(c.name);
              return (
                <li key={c.name} className="anim-up" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                  <Link
                    href={`/products?category=${encodeURIComponent(c.name)}`}
                    className="cat-card h-full"
                    style={{ "--from": v.from, "--to": v.to } as React.CSSProperties}
                  >
                    <span className="cat-emoji" aria-hidden>{v.emoji}</span>
                    {c.name === top ? (
                      <span className="mb-2 w-fit rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-bold text-[#a15f06] backdrop-blur">★ Popular</span>
                    ) : null}
                    <div className="text-lg font-extrabold leading-tight tracking-tight">{c.name}</div>
                    <div className="text-sm text-ink/60">{c.count} {c.count === 1 ? "product" : "products"}</div>
                    <span className="cat-arrow" aria-hidden>→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
