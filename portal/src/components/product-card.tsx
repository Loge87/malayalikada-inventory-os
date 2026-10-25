import Link from "next/link";

import { AddToCart } from "@/components/add-to-cart";
import type { CatalogueItem } from "@/lib/catalogue";
import { formatMoney } from "@/lib/money";
import { ProductImage } from "@/components/product-image";

export { ProductImage };
import type { PriceMode } from "@/lib/portal";

export type { PriceMode };

const STOCK_LABEL = { in: "In stock", low: "Low stock", out: "Out of stock" } as const;
const STOCK_STYLE = {
  in: "bg-white/90 text-brand",
  low: "bg-white/90 text-[#a15f06]",
  out: "bg-white/90 text-danger",
} as const;


export function ProductCard({ item, mode }: { item: CatalogueItem; mode: PriceMode }) {
  const out = item.stock === "out";
  return (
    <div className={`card card-hover group flex w-full flex-col overflow-hidden ${out ? "opacity-90" : ""}`}>
      <div className="product-media relative aspect-square overflow-hidden">
        <div className={out ? "h-full w-full grayscale-[0.6]" : "h-full w-full"}>
          <ProductImage src={item.imageUrl} alt={item.name} />
        </div>
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur ${STOCK_STYLE[item.stock]}`}>
          {mode === "approved" && item.casesAvailable !== null && item.stock !== "out"
            ? `${item.casesAvailable} ${item.casesAvailable === 1 ? "case" : "cases"} left`
            : STOCK_LABEL[item.stock]}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          {item.brand ? (
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand">{item.brand}</div>
          ) : null}
          <h3 className="mt-0.5 line-clamp-2 font-semibold leading-snug">{item.name}</h3>
          <p className="mt-1 text-sm text-muted">
            {item.variantName} · {item.sku}
          </p>
        </div>
        <div className="mt-auto space-y-3 border-t border-line pt-3">
          {mode === "approved" ? (
            <>
              {item.casePrice !== null ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-extrabold tracking-tight">{formatMoney(item.casePrice, item.currency)}</span>
                  <span className="text-xs text-muted">per case</span>
                </div>
              ) : (
                <div className="text-sm text-muted">Price on request</div>
              )}
              {out ? (
                <button type="button" disabled className="btn btn-sm w-full">Out of stock</button>
              ) : item.casePrice !== null ? (
                <AddToCart variantId={item.id} maxCases={item.casesAvailable ?? 1} />
              ) : null}
            </>
          ) : mode === "pending" ? (
            <div className="text-sm text-muted">Prices after approval</div>
          ) : mode === "suspended" ? (
            <div className="text-sm text-muted">Account on hold</div>
          ) : (
            <Link href="/login?next=/products" className="btn btn-sm btn-primary w-full">
              Sign in for price →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
