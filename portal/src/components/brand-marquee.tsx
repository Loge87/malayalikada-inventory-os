import Link from "next/link";

import { brandGradient } from "@/lib/category-visual";
import type { Facet } from "@/lib/catalogue";

function BrandTile({ brand }: { brand: Facet }) {
  const [from, to] = brandGradient(brand.name);
  return (
    <Link
      href={`/products?brand=${encodeURIComponent(brand.name)}`}
      className="brand-tile"
      aria-label={`${brand.name}, ${brand.count} ${brand.count === 1 ? "product" : "products"}`}
    >
      <span className="brand-mono" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
        {brand.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.95rem] font-bold leading-tight">{brand.name}</span>
        <span className="block text-xs text-muted">
          {brand.count} {brand.count === 1 ? "product" : "products"}
        </span>
      </span>
    </Link>
  );
}

/** A slow, endlessly scrolling row of brand tiles. Pauses on hover and falls
 *  back to a normal swipeable row for people who prefer reduced motion. */
export function BrandMarquee({ brands, reverse = false }: { brands: Facet[]; reverse?: boolean }) {
  if (brands.length === 0) return null;
  // Repeat short lists so one half of the track is always wider than the screen.
  const copies = Math.max(1, Math.ceil(10 / brands.length));
  const half = Array.from({ length: copies }, () => brands).flat();
  return (
    <div className="marquee" data-reverse={reverse ? "1" : undefined}>
      <div className="marquee-track">
        {[0, 1].map((dup) => (
          <div key={dup} className="marquee-half" aria-hidden={dup === 1 ? true : undefined}>
            {half.map((b, i) => (
              <BrandTile key={`${dup}-${i}-${b.name}`} brand={b} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
