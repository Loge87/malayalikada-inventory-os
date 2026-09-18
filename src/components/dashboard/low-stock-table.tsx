"use client";

import { useState } from "react";
import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";

import { formatMoney } from "@/lib/format";
import type { StockStatus } from "@/lib/stock-status";
import { usePagination } from "@/lib/use-pagination";
import { StockStatusPill } from "@/components/inventory/stock-status-pill";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/dashboard/table-pagination";

export type LowStockRow = {
  productId: string;
  variantId: string;
  name: string;
  category: string;
  imageUrl: string | null;
  onHand: number;
  unitPrice: number | null;
  currency: string;
  status: StockStatus;
};

type StatusFilter = "all" | "low_stock" | "out_of_stock";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

/** Same density/columns as the reference dashboard image, built from our own
 *  schema and the StockStatusPill already used on /products — thumbnail,
 *  category, quantity, price, status, quick edit link. */
export function LowStockTable({
  rows,
  threshold,
}: {
  rows: LowStockRow[];
  threshold: number;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const filteredRows = rows.filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    if (
      search.trim() &&
      !row.name.toLowerCase().includes(search.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });
  const { pageItems, page, totalPages, setPage, resetPage } =
    usePagination(filteredRows);

  return (
    <Card elevated>
      <CardHeader>
        <CardTitle>Low Stock Items</CardTitle>
        <CardDescription>
          Under {threshold} on hand, or out of stock — lowest quantity first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-xs">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(filter.value);
                      resetPage();
                    }}
                    aria-pressed={statusFilter === filter.value}
                    className={
                      statusFilter === filter.value
                        ? "rounded-md bg-background px-3 py-1.5 font-medium text-foreground shadow-sm ring-1 ring-foreground/10"
                        : "rounded-md px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground"
                    }
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="Filter by item name…"
                className="max-w-xs"
              />
            </div>

            {pageItems.length > 0 ? (
              <>
              <p className="mb-1 text-xs text-muted-foreground sm:hidden">
                Scroll to see more →
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="w-10 py-2 font-medium" aria-hidden />
                      <th className="py-2 pr-4 font-medium">Item</th>
                      <th className="py-2 pr-4 font-medium">Category</th>
                      <th className="py-2 pr-4 text-right font-medium">Qty</th>
                      <th className="py-2 pr-4 text-right font-medium">Price</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 font-medium" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((row) => (
                      <tr
                        key={row.variantId}
                        className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                      >
                        <td className="py-3 pr-2">
                          {row.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.imageUrl}
                              alt=""
                              className="size-9 rounded-md object-cover ring-1 ring-foreground/10"
                            />
                          ) : (
                            <div className="flex size-9 items-center justify-center rounded-md bg-muted ring-1 ring-foreground/10">
                              <ImageIcon className="size-4 text-muted-foreground" />
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="block max-w-56 truncate font-medium">
                            {row.name}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {row.category}
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                          {row.onHand}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                          {row.unitPrice != null
                            ? formatMoney(row.unitPrice, row.currency)
                            : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <StockStatusPill status={row.status} />
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            href={`/products/${row.productId}/edit`}
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 hover:bg-muted hover:text-foreground"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            ) : (
              <p className="text-muted-foreground">No items match this filter</p>
            )}
            <TablePagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        ) : (
          <p className="text-muted-foreground">
            Nothing low or out of stock right now
          </p>
        )}
      </CardContent>
    </Card>
  );
}
