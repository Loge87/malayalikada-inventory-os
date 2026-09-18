import { cn } from "@/lib/utils";
import type { BulkRowResult } from "@/lib/bulk-upload/schema";

// Same --status-* tokens as StockStatusPill (globals.css) — one status
// vocabulary for the whole app, not a second hardcoded palette here.
const STYLES: Record<BulkRowResult["status"], string> = {
  valid: "bg-status-success/10 text-status-success",
  skipped_duplicate: "bg-status-warning/10 text-status-warning",
  error: "bg-status-critical/10 text-status-critical",
};

const LABELS: Record<BulkRowResult["status"], string> = {
  valid: "Will import",
  skipped_duplicate: "Skipped",
  error: "Error",
};

export function BulkRowStatusPill({ status }: { status: BulkRowResult["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STYLES[status]
      )}
    >
      {LABELS[status]}
    </span>
  );
}
