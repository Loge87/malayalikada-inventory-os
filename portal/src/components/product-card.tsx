import type { CatalogueItem } from "@/lib/catalogue";
import { formatMoney } from "@/lib/catalogue";
import type { PriceMode } from "@/lib/portal";

export type { PriceMode };

const STOCK_LABEL = { in: "In stock", low: "Low stock", out: "Out of stock" } as const;
const STOCK_STYLE = {
  in: "bg-brand/10 text-brand",
  low: "bg-accent/15 text-[#a15f06]",
  out: "bg-danger/10 text-danger",
} as const;

export function ProductImage({ src, alt, fit = "contain" }: { src: string | null; alt: string; fit?: "contain" | "cover" }) {
  return (
    // Signed storage URLs expire, so next/image optimisation does not apply.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src ?? "/placeholder-product.svg"}
      alt={src ? alt : `${alt} (no image available)`}
      className={`h-full w-full ${src && fit === "contain" ? "object-contain p-4" : "object-cover"}`}
      loading="lazy"
    />
  );
}

export function ProductCard({ item, mode }: { item: CatalogueItem; mode: PriceMode }) {
  return (
    <div className="card card-hover group flex w-full flex-col overflow-hidden">
      <div className="product-media relative aspect-square overflow-hidden">
        <ProductImage src={item.imageUrl} alt={item.name} />
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur ${STOCK_STYLE[item.stock]}`}>
          {mode === "approved" && item.casesAvailable !== null && item.stock !== "out"
            ? `${item.casesAvailable} cases`
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
        <p className="text-sm text-muted">
          1 case = <strong className="text-ink">{item.unitsPerCase}</strong> {item.unitsPerCase === 1 ? "item" : "items"}
        </p>
        <div className="mt-auto border-t border-line pt-3">
          {mode === "approved" ? (
            item.casePrice !== null ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold tracking-tight">{formatMoney(item.casePrice, item.currency)}</span>
                <span className="text-xs text-muted">per case</span>
              </div>
            ) : (
              <div className="text-sm text-muted">Price on request</div>
            )
          ) : mode === "pending" ? (
            <div className="text-sm text-muted">Prices after approval</div>
          ) : mode === "suspended" ? (
            <div className="text-sm text-muted">Account on hold</div>
          ) : (
            <div className="text-sm font-semibold text-brand">Sign in for price →</div>
          )}
        </div>
      </div>
    </div>
  );
}
