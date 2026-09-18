"use client";

import { useState } from "react";

import { formatDateTime } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import {
  MOVEMENT_BUCKET_COLOR_VAR,
  MOVEMENT_BUCKET_LABELS,
  MOVEMENT_BUCKET_ORDER,
  MOVEMENT_TYPE_ICON,
  movementBucket,
  movementTypeLabel,
  type MovementBucket,
} from "@/lib/movement-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TablePagination } from "@/components/dashboard/table-pagination";

export type ActivityRow = {
  id: string;
  variantLabel: string;
  movementType: string;
  locationName: string;
  createdAt: string;
  quantity: number;
};

type BucketFilter = "all" | MovementBucket;

function signed(quantity: number): string {
  return quantity > 0 ? `+${quantity}` : String(quantity);
}

export function RecentActivityFeed({ rows }: { rows: ActivityRow[] }) {
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>("all");

  const filteredRows =
    bucketFilter === "all"
      ? rows
      : rows.filter((row) => movementBucket(row.movementType) === bucketFilter);
  const { pageItems, page, totalPages, setPage, resetPage } =
    usePagination(filteredRows);

  return (
    <Card elevated>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          {rows.length} stock movement{rows.length === 1 ? "" : "s"} across
          all locations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setBucketFilter("all");
                  resetPage();
                }}
                aria-pressed={bucketFilter === "all"}
                className={
                  bucketFilter === "all"
                    ? "rounded-md bg-background px-3 py-1.5 font-medium text-foreground shadow-sm ring-1 ring-foreground/10"
                    : "rounded-md px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground"
                }
              >
                All
              </button>
              {MOVEMENT_BUCKET_ORDER.map((bucket) => (
                <button
                  key={bucket}
                  type="button"
                  onClick={() => {
                    setBucketFilter(bucket);
                    resetPage();
                  }}
                  aria-pressed={bucketFilter === bucket}
                  className={
                    bucketFilter === bucket
                      ? "rounded-md bg-background px-3 py-1.5 font-medium text-foreground shadow-sm ring-1 ring-foreground/10"
                      : "rounded-md px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground"
                  }
                >
                  {MOVEMENT_BUCKET_LABELS[bucket]}
                </button>
              ))}
            </div>

            {pageItems.length > 0 ? (
              <ul className="divide-y divide-border">
                {pageItems.map((row) => {
                  const bucket = movementBucket(row.movementType);
                  const Icon = MOVEMENT_TYPE_ICON[row.movementType];
                  const colorVar = MOVEMENT_BUCKET_COLOR_VAR[bucket];
                  return (
                    <li key={row.id} className="flex items-center gap-3 py-3">
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: `color-mix(in oklch, ${colorVar} 15%, transparent)`,
                        }}
                      >
                        {Icon ? (
                          <Icon className="size-4" style={{ color: colorVar }} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{row.variantLabel}</span>
                        <span className="text-muted-foreground text-xs">
                          {movementTypeLabel(row.movementType)} ·{" "}
                          {row.locationName} · {formatDateTime(row.createdAt)}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums">
                        {signed(row.quantity)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                No movements match this filter
              </p>
            )}
            <TablePagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        ) : (
          <p className="text-muted-foreground">No movements recorded yet</p>
        )}
      </CardContent>
    </Card>
  );
}
