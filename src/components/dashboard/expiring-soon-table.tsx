"use client";

import { useMemo, useState } from "react";

import { daysUntil, formatDate } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination } from "@/components/dashboard/table-pagination";

export type ExpiringSoonRow = {
  id: string;
  variantLabel: string;
  batchNumber: string;
  locationName: string;
  expiryDate: string;
  quantityRemaining: number;
};

const ALL_LOCATIONS = "__all__";

export function ExpiringSoonTable({
  rows,
  windowDays,
}: {
  rows: ExpiringSoonRow[];
  windowDays: number;
}) {
  const [locationFilter, setLocationFilter] = useState(ALL_LOCATIONS);

  const locationNames = useMemo(
    () => [...new Set(rows.map((r) => r.locationName))].sort(),
    [rows]
  );
  const locationItems = useMemo(
    () => ({
      [ALL_LOCATIONS]: "All locations",
      ...Object.fromEntries(locationNames.map((name) => [name, name])),
    }),
    [locationNames]
  );

  const filteredRows =
    locationFilter === ALL_LOCATIONS
      ? rows
      : rows.filter((r) => r.locationName === locationFilter);
  const { pageItems, page, totalPages, setPage, resetPage } =
    usePagination(filteredRows);

  return (
    <Card elevated>
      <CardHeader>
        <CardTitle>Expiring soon</CardTitle>
        <CardDescription>
          Batches with stock left, expiring within {windowDays} days.
          Already-expired batches are highlighted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <div className="flex flex-col gap-3">
            {locationNames.length > 1 ? (
              <Select
                items={locationItems}
                value={locationFilter}
                onValueChange={(value) => {
                  if (value == null) return;
                  setLocationFilter(value);
                  resetPage();
                }}
              >
                <SelectTrigger className="w-fit min-w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(locationItems).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {pageItems.length > 0 ? (
              <div className="overflow-x-auto">
                {/* .table/.table-head/.table-row — CORRECTED: this table used
                    to be raw markup (a plain <table> + manually-styled <tr>s,
                    duplicating border/background/hover CSS .table-head/
                    .table-row already provide) instead of the shared classes
                    every other table in the app uses. That's the specific
                    reason this was the one table edge-padding missed earlier
                    — a per-table Tailwind patch never reaches a table that
                    isn't opted into the shared class in the first place. */}
                <table className="table">
                  <thead>
                    <tr className="table-head">
                      <th className="pr-4 font-medium">Variant</th>
                      <th className="pr-4 font-medium">Batch</th>
                      <th className="pr-4 font-medium">Location</th>
                      <th className="pr-4 font-medium">Expiry</th>
                      <th className="cell-number font-medium">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((row) => {
                      const days = daysUntil(row.expiryDate);
                      const expired = days < 0;
                      return (
                        <tr
                          key={row.id}
                          className={
                            expired
                              ? "table-row bg-destructive/10 hover:bg-destructive/15"
                              : "table-row"
                          }
                        >
                          <td className="py-3 pr-4">{row.variantLabel}</td>
                          <td className="py-3 pr-4">{row.batchNumber}</td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {row.locationName}
                          </td>
                          <td className="py-3 pr-4">
                            {formatDate(row.expiryDate)}
                            <span
                              className={
                                expired
                                  ? "block text-xs font-medium text-destructive"
                                  : "block text-xs text-muted-foreground"
                              }
                            >
                              {expired ? `expired ${-days}d ago` : `in ${days}d`}
                            </span>
                          </td>
                          <td className="cell-number py-3 tabular-nums">
                            {row.quantityRemaining}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Nothing expiring at this location
              </p>
            )}
            <TablePagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        ) : (
          <p className="text-muted-foreground">
            Nothing expiring in the next {windowDays} days
          </p>
        )}
      </CardContent>
    </Card>
  );
}
