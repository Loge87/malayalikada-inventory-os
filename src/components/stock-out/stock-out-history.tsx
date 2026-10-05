"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StockOutRow = {
  id: string;
  createdAt: string;
  quantity: number;
  clientName: string;
  locationName: string;
  productLabel: string;
};

export type FilterOption = { id: string; label: string };

export type StockOutFilters = {
  clientId: string | null;
  productVariantId: string | null;
  locationId: string | null;
  from: string | null;
  to: string | null;
};

const DATE_PRESETS = [
  "Today",
  "This week",
  "This month",
  "Last 30 days",
] as const;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Computes [from, to] (both inclusive, yyyy-mm-dd) for a quick preset,
 *  relative to right now — recomputed each time it's picked, not stored. */
function presetRange(preset: (typeof DATE_PRESETS)[number]): [string, string] {
  const now = new Date();
  const today = isoDate(now);
  if (preset === "Today") return [today, today];
  if (preset === "This week") {
    const start = new Date(now);
    // Monday as the first day of the week.
    const day = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - day);
    return [isoDate(start), today];
  }
  if (preset === "This month") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return [isoDate(start), today];
  }
  // Last 30 days
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 29);
  return [isoDate(start), today];
}

/**
 * Filter controls shared between the desktop inline bar and the mobile
 * dialog — one implementation, not two drifting copies. Each control
 * applies immediately (no separate "Apply" step), consistent with every
 * other filter in this app (ProductsTable's own search/status/category/
 * location row).
 */
function FilterControls({
  clientOptions,
  productOptions,
  locationOptions,
  filters,
  onChange,
}: {
  clientOptions: FilterOption[];
  productOptions: FilterOption[];
  locationOptions: FilterOption[];
  filters: StockOutFilters;
  onChange: (patch: Partial<StockOutFilters>) => void;
}) {
  const clientItems = Object.fromEntries(clientOptions.map((c) => [c.id, c.label]));
  const productItems = Object.fromEntries(productOptions.map((p) => [p.id, p.label]));
  const locationItems: Record<string, string> = {
    all: "All locations",
    ...Object.fromEntries(locationOptions.map((l) => [l.id, l.label])),
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field className="w-full sm:w-48">
        <FieldLabel htmlFor="history-client">Client</FieldLabel>
        <Combobox
          id="history-client"
          items={clientItems}
          value={filters.clientId}
          onValueChange={(value) => onChange({ clientId: value })}
          placeholder="Any client"
        />
      </Field>

      <Field className="w-full sm:w-56">
        <FieldLabel htmlFor="history-product">Product</FieldLabel>
        <Combobox
          id="history-product"
          items={productItems}
          value={filters.productVariantId}
          onValueChange={(value) => onChange({ productVariantId: value })}
          placeholder="Any product, name or SKU"
        />
      </Field>

      <Field className="w-full sm:w-44">
        <FieldLabel htmlFor="history-location">Location</FieldLabel>
        <Select
          items={locationItems}
          value={filters.locationId ?? "all"}
          onValueChange={(value) => {
            if (value == null) return;
            onChange({ locationId: value === "all" ? null : value });
          }}
        >
          <SelectTrigger id="history-location" className="w-full">
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
      </Field>

      <Field className="w-full sm:w-36">
        <FieldLabel htmlFor="history-preset">Date range</FieldLabel>
        <Select
          items={Object.fromEntries(DATE_PRESETS.map((p) => [p, p]))}
          value={null}
          onValueChange={(value) => {
            if (value == null) return;
            const [from, to] = presetRange(value as (typeof DATE_PRESETS)[number]);
            onChange({ from, to });
          }}
        >
          <SelectTrigger id="history-preset" className="w-full">
            <SelectValue placeholder="Quick range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_PRESETS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field className="w-full sm:w-36">
        <FieldLabel htmlFor="history-from">From</FieldLabel>
        <Input
          id="history-from"
          type="date"
          value={filters.from ?? ""}
          onChange={(event) => onChange({ from: event.target.value || null })}
        />
      </Field>
      <Field className="w-full sm:w-36">
        <FieldLabel htmlFor="history-to">To</FieldLabel>
        <Input
          id="history-to"
          type="date"
          value={filters.to ?? ""}
          onChange={(event) => onChange({ to: event.target.value || null })}
        />
      </Field>
    </div>
  );
}

/**
 * The /stock-out "History" tab — a filtered, most-recent-first list of
 * every stock-out in the org (not just this user's own), with four
 * combinable filters persisted as URL query params so a filtered view can
 * be reloaded or shared. Desktop shows the filter row inline (compact,
 * matching ProductsTable's own filter-row convention); mobile collapses it
 * behind a single "Filters" button that opens the same controls in a
 * dialog, keeping the list itself uncluttered by default.
 */
export function StockOutHistory({
  stockOuts,
  clientOptions,
  productOptions,
  locationOptions,
  filters,
}: {
  stockOuts: StockOutRow[];
  clientOptions: FilterOption[];
  productOptions: FilterOption[];
  locationOptions: FilterOption[];
  filters: StockOutFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeFilterCount =
    (filters.clientId ? 1 : 0) +
    (filters.productVariantId ? 1 : 0) +
    (filters.locationId ? 1 : 0) +
    (filters.from || filters.to ? 1 : 0);

  function updateFilters(patch: Partial<StockOutFilters>) {
    const next = new URLSearchParams(searchParams.toString());
    const merged = { ...filters, ...patch };
    const entries: [string, string | null][] = [
      ["client", merged.clientId],
      ["product", merged.productVariantId],
      ["location", merged.locationId],
      ["from", merged.from],
      ["to", merged.to],
    ];
    for (const [key, value] of entries) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function clearAll() {
    const next = new URLSearchParams(searchParams.toString());
    for (const key of ["client", "product", "location", "from", "to"]) {
      next.delete(key);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Desktop: an always-visible, single compact row — same convention
          as ProductsTable's own search/status/category/location row.
          Mobile: collapsed behind one "Filters" button + a dialog, so the
          list stays the default view on a small screen. */}
      <div className="hidden lg:block">
        <FilterControls
          clientOptions={clientOptions}
          productOptions={productOptions}
          locationOptions={locationOptions}
          filters={filters}
          onChange={updateFilters}
        />
      </div>

      <div className="flex items-center gap-2 lg:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMobileFiltersOpen(true)}
          className="gap-1.5"
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {activeFilterCount > 0 ? (
            <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-brand-accent text-[10px] font-semibold text-brand-accent-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
        {activeFilterCount > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="hidden items-center gap-2 lg:flex">
        {activeFilterCount > 0 ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} applied
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
              Clear all
            </button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">No filters applied</span>
        )}
      </div>

      <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription>
              Narrow the list below — applies immediately.
            </DialogDescription>
          </DialogHeader>
          <FilterControls
            clientOptions={clientOptions}
            productOptions={productOptions}
            locationOptions={locationOptions}
            filters={filters}
            onChange={updateFilters}
          />
          {activeFilterCount > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={clearAll} className="w-fit">
              Clear all filters
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>

      <Card elevated>
        <CardHeader>
          <CardTitle>Stock-out history</CardTitle>
          <CardDescription>
            Every stock-out in the organisation, most recent first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stockOuts.length === 0 ? (
            <p className="text-muted-foreground">
              {activeFilterCount > 0
                ? "No stock-outs match these filters"
                : "No stock-outs recorded yet"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              {/* .table/.table-head/.table-row, not raw markup — see
                  expiring-soon-table.tsx's own note for why. */}
              <table className="table">
                <thead>
                  <tr className="table-head">
                    <th className="pr-2 font-medium">Date</th>
                    <th className="pr-2 font-medium">Product</th>
                    <th className="pr-2 font-medium">Location</th>
                    <th className="pr-2 font-medium">Client</th>
                    <th className="cell-number font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {stockOuts.map((row) => (
                    <tr key={row.id} className="table-row">
                      <td className="py-2.5 pr-2 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="py-2.5 pr-2">{row.productLabel}</td>
                      <td className="py-2.5 pr-2">{row.locationName}</td>
                      <td className="py-2.5 pr-2">{row.clientName}</td>
                      <td className="cell-number py-2.5 font-medium tabular-nums">
                        {row.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
