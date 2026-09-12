import { cn } from "@/lib/utils";
import type { BulkRowResult } from "@/lib/bulk-upload/schema";

const STYLES: Record<BulkRowResult["status"], string> = {
  valid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  skipped_duplicate: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  error: "bg-red-500/10 text-red-700 dark:text-red-400",
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
