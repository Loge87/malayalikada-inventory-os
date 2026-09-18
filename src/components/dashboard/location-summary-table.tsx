"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatMoney } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/dashboard/table-pagination";

export type LocationSummaryRow = {
  id: string;
  name: string;
  /** Sorted by value descending; same currency-grouping as the "Total
   *  stock value" stat card, scoped to this location. */
  valueByCurrency: [string, number][];
  totalSkus: number;
  outOfStockCount: number;
  lowStockCount: number;
};

/** The primary (largest) currency's amount — what the inline comparison bar
 *  is drawn from. Multiple currencies at one location are rare in practice,
 *  and the bar is a relative-magnitude cue, not an exact accounting figure. */
function primaryAmount(entries: [string, number][]): number {
  return entries[0]?.[1] ?? 0;
}

function ValueCell({
  entries,
  maxValue,
}: {
  entries: [string, number][];
  maxValue: number;
}) {
  if (entries.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const [primary, ...rest] = entries;
  const widthPercent = maxValue > 0 ? (primary[1] / maxValue) * 100 : 0;
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="tabular-nums">
        {formatMoney(primary[1], primary[0])}
        {rest.length > 0 ? (
          <span className="ml-1 text-xs text-muted-foreground">
            + {rest.map(([c, v]) => formatMoney(v, c)).join(", ")}
          </span>
        ) : null}
      </span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${widthPercent}%`,
            backgroundColor: "var(--chart-1)",
          }}
        />
      </div>
    </div>
  );
}

/** One row per location — same stock-value calculation as the top stat
 *  card (grouped by currency, never converted), scoped to that location's
 *  own inventory_levels rows. Status counts reuse getStockStatus from
 *  lib/stock-status.ts (see dashboard/page.tsx), not a re-implementation. */
export function LocationSummaryTable({ rows }: { rows: LocationSummaryRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  // The comparison bar is relative to the highest-value location across the
  // whole dataset, not just the current filtered/paginated page — otherwise
  // filtering would rescale the bars mid-comparison.
  const maxValue = Math.max(0, ...rows.map((row) => primaryAmount(row.valueByCurrency)));

  const filteredRows = search.trim()
    ? rows.filter((row) =>
        row.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : rows;
  const { pageItems, page, totalPages, setPage, resetPage } =
    usePagination(filteredRows);

  return (
    <Card elevated>
      <CardHeader>
        <CardTitle>Stock by location</CardTitle>
        <CardDescription>
          Stock value (bar shows relative size vs. the highest-value
          location), SKU count, and stock health per location. Click a row
          for that location&apos;s stock list.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <div className="flex flex-col gap-3">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              placeholder="Filter by location name…"
              className="max-w-xs"
            />
            {pageItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Location</th>
                      <th className="py-2 pr-4 text-right font-medium">
                        Stock value
                      </th>
                      <th className="py-2 pr-4 text-right font-medium">
                        Total SKUs
                      </th>
                      <th className="py-2 pr-4 text-right font-medium">
                        Out of stock
                      </th>
                      <th className="py-2 pr-4 text-right font-medium">Low stock</th>
                      <th className="py-2 font-medium" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => router.push(`/products?location=${row.id}`)}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-3 pr-4 font-medium">{row.name}</td>
                        <td className="py-3 pr-4">
                          <ValueCell
                            entries={row.valueByCurrency}
                            maxValue={maxValue}
                          />
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {row.totalSkus}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {row.outOfStockCount > 0 ? (
                            <span className="text-destructive">
                              {row.outOfStockCount}
                            </span>
                          ) : (
                            row.outOfStockCount
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {row.lowStockCount}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            href={`/products?location=${row.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 hover:bg-muted hover:text-foreground"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground">
                No locations match &quot;{search}&quot;
              </p>
            )}
            <TablePagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        ) : (
          <p className="text-muted-foreground">No locations yet</p>
        )}
      </CardContent>
    </Card>
  );
}
