"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";

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
  /** financials:view only — see dashboard/page.tsx's own comment at the
   *  calculation for why this currently equals Stock Value exactly. */
  landedCostNzd: number;
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
export function LocationSummaryTable({
  rows,
  showFinancials,
  usdRate,
}: {
  rows: LocationSummaryRow[];
  /** admin/owner only (financials:view) — when false, the Landed Cost and
   *  USD columns aren't just hidden via CSS, they're not rendered into the
   *  DOM at all (no <th>/<td> for either), so a staff account genuinely
   *  never receives this markup. */
  showFinancials: boolean;
  /** NZD→USD, refreshed server-side at most once/hour (see
   *  lib/exchange-rate.ts) — null means the rate fetch failed or wasn't
   *  attempted; the USD column shows "Rate unavailable" per row instead of
   *  a number. Always null when showFinancials is false (the page skips
   *  fetching it for roles that can't see the column anyway). */
  usdRate: number | null;
}) {
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
                {/* .table/.table-head/.table-row, not raw markup — see
                    expiring-soon-table.tsx's own note for why. */}
                <table className="table">
                  <thead>
                    <tr className="table-head">
                      <th className="pr-4 font-medium">Location</th>
                      <th className="cell-number pr-4 font-medium">
                        Stock value
                      </th>
                      {showFinancials ? (
                        <>
                          <th className="cell-number pr-4 font-medium">
                            <span
                              className="inline-flex items-center gap-1"
                              title="Currently the same calculation as Stock Value (unit_price × on_hand). Refinement pending — freight, duty, and similar costs aren't included yet."
                            >
                              Landed Cost (NZD)
                              <Info className="size-3.5 shrink-0" aria-hidden />
                            </span>
                          </th>
                          <th className="cell-number pr-4 font-medium">USD</th>
                        </>
                      ) : null}
                      <th className="cell-number pr-4 font-medium">
                        Total SKUs
                      </th>
                      <th className="cell-number pr-4 font-medium">
                        Out of stock
                      </th>
                      <th className="cell-number pr-4 font-medium">Low stock</th>
                      <th className="font-medium" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => router.push(`/products?location=${row.id}`)}
                        className="table-row cursor-pointer"
                      >
                        <td className="py-3 pr-4 font-medium">{row.name}</td>
                        <td className="cell-number py-3 pr-4">
                          <ValueCell
                            entries={row.valueByCurrency}
                            maxValue={maxValue}
                          />
                        </td>
                        {showFinancials ? (
                          <>
                            <td className="cell-number py-3 pr-4 tabular-nums">
                              {formatMoney(row.landedCostNzd, "NZD")}
                            </td>
                            <td className="cell-number py-3 pr-4 tabular-nums">
                              {usdRate != null ? (
                                formatMoney(row.landedCostNzd * usdRate, "USD")
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Rate unavailable
                                </span>
                              )}
                            </td>
                          </>
                        ) : null}
                        <td className="cell-number py-3 pr-4 tabular-nums">
                          {row.totalSkus}
                        </td>
                        <td className="cell-number py-3 pr-4 tabular-nums">
                          {row.outOfStockCount > 0 ? (
                            <span className="text-destructive">
                              {row.outOfStockCount}
                            </span>
                          ) : (
                            row.outOfStockCount
                          )}
                        </td>
                        <td className="cell-number py-3 pr-4 tabular-nums">
                          {row.lowStockCount}
                        </td>
                        <td className="cell-number py-3">
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
