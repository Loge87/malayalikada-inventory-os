import { cn } from "@/lib/utils";
import type { StockStatus } from "@/lib/stock-status";

// Reads from the --status-* tokens in globals.css, not raw Tailwind color
// classes — the CSS variable already swaps value in dark mode, so no
// dark: prefix is needed here the way a hardcoded emerald-700 would.
const STYLES: Record<StockStatus, string> = {
  in_stock: "bg-status-success/10 text-status-success",
  low_stock: "bg-status-warning/10 text-status-warning",
  out_of_stock: "bg-status-critical/10 text-status-critical",
  inactive: "bg-muted text-muted-foreground",
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
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STYLES[status],
        className
      )}
    >
      {LABELS[status]}
    </span>
  );
}
