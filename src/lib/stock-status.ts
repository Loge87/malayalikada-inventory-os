// Shared stock-status thresholds/logic so /products, /dashboard, /scan, and
// /stock-counts all classify (and colour) stock the same way.
export const LOW_STOCK_THRESHOLD = 10;

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "inactive";

export function getStockStatus(
  onHand: number,
  isActive: boolean = true
): StockStatus {
  if (!isActive) return "inactive";
  if (onHand <= 0) return "out_of_stock";
  if (onHand < LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}
