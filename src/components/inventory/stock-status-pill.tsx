import { cn } from "@/lib/utils";
import type { StockStatus } from "@/lib/stock-status";

const STYLES: Record<StockStatus, string> = {
  in_stock: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  low_stock: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  out_of_stock: "bg-red-500/10 text-red-700 dark:text-red-400",
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
