"use client";

import { cn } from "@/lib/utils";

export const DAY_RANGES = [7, 30, 90] as const;
export type DayRange = (typeof DAY_RANGES)[number];

export function DayRangeToggle({
  value,
  onChange,
}: {
  value: DayRange;
  onChange: (value: DayRange) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-lg bg-muted p-1 text-xs">
      {DAY_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          aria-pressed={value === range}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition-colors",
            value === range
              ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {range}d
        </button>
      ))}
    </div>
  );
}
