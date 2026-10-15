import type { CatalogueItem } from "@/lib/catalogue";
import { formatMoney } from "@/lib/catalogue";

const STOCK_LABEL = { in: "In stock", low: "Low stock", out: "Out of stock" } as const;
const STOCK_STYLE = {
  in: "bg-brand/10 text-brand",
  low: "bg-accent/15 text-accent",
  out: "bg-danger/10 text-danger",
} as const;

export type PriceMode = "guest" | "pending" | "approved" | "suspended";

export function ProductCard({ item, mode }: { item: CatalogueItem; mode: PriceMode }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex aspect-[4/3] items-center justify-center bg-bg">
        {item.imageUrl ? (
          // Signed storage URL that expires, so next/image optimisation does not apply.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="text-4xl text-line" aria-hidden>▢</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          {item.brand ? <div className="text-xs font-medium uppercase tracking-wide text-muted">{item.brand}</div> : null}
          <h3 className="font-semibold leading-snug">{item.name}</h3>
          <p className="text-sm text-muted">
            {item.variantName} · {item.sku}
          </p>
        </div>
        <p className="text-sm">
          1 case = <strong>{item.unitsPerCase}</strong> {item.unitsPerCase === 1 ? "item" : "items"}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            {mode === "approved" ? (
              item.casePrice !== null ? (
                <>
                  <div className="text-lg font-bold">{formatMoney(item.casePrice, item.currency)}</div>
                  <div className="text-xs text-muted">per case</div>
                </>
              ) : (
                <div className="text-sm text-muted">Price on request</div>
              )
            ) : mode === "pending" ? (
              <div className="text-sm text-muted">Prices after approval</div>
            ) : mode === "suspended" ? (
              <div className="text-sm text-muted">Account on hold</div>
            ) : (
              <div className="text-sm font-medium text-brand">Sign in for price</div>
            )}
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STOCK_STYLE[item.stock]}`}>
            {mode === "approved" && item.casesAvailable !== null && item.stock !== "out"
              ? `${item.casesAvailable} cases`
              : STOCK_LABEL[item.stock]}
          </span>
        </div>
      </div>
    </li>
  );
}
