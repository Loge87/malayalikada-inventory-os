import { cn } from "@/lib/utils";
import type { StockStatus } from "@/lib/stock-status";

// One of ui.css's four pill color variants — each already reads from the
// matching --status-*/--status-*-bg pair in theme.css, so no dark: prefix
// is needed here the way a hardcoded emerald-700 would.
const STYLES: Record<StockStatus, string> = {
  in_stock: "pill-success",
  low_stock: "pill-warning",
  out_of_stock: "pill-critical",
  inactive: "pill-neutral",
};

const LABELS: Record<StockStatus, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  inactive: "Inactive",
};

/** The one stock-status pill used everywhere stock is shown, so the colours
 *  and labels can't drift apart between pages. */
export function StockStatusPill({
  status,
  className,
}: {
  status: StockStatus;
  className?: string;
}) {
  return (
    <span
      className={cn("pill", STYLES[status], className)}
    >
      {LABELS[status]}
    </span>
  );
}
