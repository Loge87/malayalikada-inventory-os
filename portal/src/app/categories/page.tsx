import Link from "next/link";

import { loadFacets } from "@/lib/catalogue";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { categories } = await loadFacets();
  const top = [...categories].sort((a, b) => b.count - a.count)[0]?.name;

  return (
    <div className="container-page anim-up py-14">
      <p className="eyebrow">Shop the pantry</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Categories</h1>
      {categories.length === 0 ? (
        <p className="mt-6 text-muted">No categories to show yet.</p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => (
            <li key={c.name}>
              <Link href={`/products?category=${encodeURIComponent(c.name)}`} className="card card-hover relative block p-6">
                {c.name === top ? (
                  <span className="absolute right-3 top-3 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-[#a15f06]">Popular</span>
                ) : null}
                <div className="font-bold">{c.name}</div>
                <div className="text-sm text-muted">{c.count} {c.count === 1 ? "product" : "products"}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
