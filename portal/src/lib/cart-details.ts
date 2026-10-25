import { loadItemsByIds, type CatalogueItem } from "@/lib/catalogue";
import { readCart } from "@/lib/cart";
import type { PortalSettings } from "@/lib/portal";

export type CartDetailLine = {
  item: CatalogueItem;
  cases: number;
  lineTotal: number | null;
  /** Why this line can't be ordered as it stands. */
  problem: "no_price" | "out" | "short" | null;
  availableCases: number;
};

export type CartDetails = {
  lines: CartDetailLine[];
  /** Ids in the cookie that are no longer in the portal. */
  removedIds: string[];
  subtotal: number;
  currency: string;
  hasProblems: boolean;
};

/** Cart with live prices and stock. Only meaningful for approved retailers. */
export async function loadCartDetails(settings: PortalSettings): Promise<CartDetails> {
  const cart = await readCart();
  const items = await loadItemsByIds(cart.map((c) => c.variantId), settings, true);
  const byId = new Map(items.map((i) => [i.id, i]));

  const lines: CartDetailLine[] = [];
  const removedIds: string[] = [];
  for (const c of cart) {
    const item = byId.get(c.variantId);
    if (!item) {
      removedIds.push(c.variantId);
      continue;
    }
    const availableCases = item.casesAvailable ?? 0;
    const problem: CartDetailLine["problem"] =
      item.casePrice === null ? "no_price" : availableCases <= 0 ? "out" : c.cases > availableCases ? "short" : null;
    lines.push({
      item,
      cases: c.cases,
      lineTotal: item.casePrice === null ? null : Math.round(item.casePrice * c.cases * 100) / 100,
      problem,
      availableCases,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0);
  return {
    lines,
    removedIds,
    subtotal: Math.round(subtotal * 100) / 100,
    currency: lines[0]?.item.currency ?? settings.currency,
    hasProblems: lines.some((l) => l.problem !== null),
  };
}
