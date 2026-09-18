"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Image as ImageIcon } from "lucide-react";

import { bulkDeleteProducts } from "@/app/(app)/products/actions";
import { formatMoney } from "@/lib/format";
import { getStockStatus, type StockStatus } from "@/lib/stock-status";
import { useIsWideDesktop } from "@/lib/use-media-query";
import { usePagination } from "@/lib/use-pagination";
import {
  applyPriceSettings,
  type PriceSettingsRates,
} from "@/lib/price-calculation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StockStatusPill } from "@/components/inventory/stock-status-pill";
import { usePermissions } from "@/components/providers/role-provider";
import { TablePagination } from "@/components/dashboard/table-pagination";
import {
  MoveStockDialog,
  type MoveStockVariant,
} from "@/components/products/move-stock-dialog";
import type { LocationOption } from "@/components/products/variant-extra-fields";
import { cn } from "@/lib/utils";

export type EditableVariant = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  currency: string;
  packPrice: number | null;
  unitsPerPack: number;
  unitPrice: number | null;
  onHand: number;
};

export type EditableProduct = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  imageUrl: string | null;
  isActive: boolean;
  variants: EditableVariant[];
};

type Row = { product: EditableProduct; variant: EditableVariant | null };
type SortKey = "name" | "sku" | "stock" | "price";

const STATUS_FILTER_LABELS: Record<StockStatus, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  inactive: "Inactive",
};

const ALL_STATUSES = "all";
const ALL_CATEGORIES = "all";
const STATUS_ITEMS: Record<string, string> = {
  [ALL_STATUSES]: "All statuses",
  ...STATUS_FILTER_LABELS,
};

function variantLabel(row: Row): string {
  return row.variant
    ? `${row.product.name} — ${row.variant.name}`
    : row.product.name;
}

/** Unique per row — a variant's id, or a prefixed product id for a product
 *  with no variants yet (so it can never collide with a real variant id). */
function rowKey(row: Row): string {
  return row.variant ? row.variant.id : `product:${row.product.id}`;
}

/** One price column's cell — em dash when that variant has no value set for
 *  this particular price field, since the four price columns are now
 *  independent rather than one combined cell. */
function moneyCell(value: number | null | undefined, currency: string | undefined) {
  if (value == null || !currency) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="tabular-nums">{formatMoney(value, currency)}</span>;
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = activeKey === sortKey;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={cn("py-2 font-medium", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-muted-foreground hover:text-foreground",
          align === "right" && "flex-row-reverse"
        )}
      >
        {label}
        <Icon className={cn("size-3", active && "text-foreground")} />
      </button>
    </th>
  );
}

export function ProductsTable({
  products,
  locations,
  priceSettings,
  initialStatusFilter = null,
  selectedProductId = null,
  onSelectProduct,
}: {
  products: EditableProduct[];
  locations: LocationOption[];
  /** The organisation's saved Price Settings rates, or null if it's never
   *  saved any — drives the Retail Price / Wholesale Price columns
   *  (src/lib/price-calculation.ts: retail from unit price, wholesale from
   *  pack/box price). null shows a "Set price settings" banner instead of
   *  a broken calculation. */
  priceSettings: PriceSettingsRates | null;
  /** From /products?status=... — e.g. a dashboard stat card linking to the
   *  low-stock or out-of-stock subset. */
  initialStatusFilter?: StockStatus | null;
  /** The product currently open in the desktop side panel (owned by the
   *  parent, ProductsPageContent) — only used to highlight its row(s) here. */
  selectedProductId?: string | null;
  /** Desktop: open/replace the side panel with this product. Mobile never
   *  calls this — openEdit() below routes to the full-page edit route
   *  instead, so the parent's panel state simply stays empty. */
  onSelectProduct: (productId: string) => void;
}) {
  const router = useRouter();
  const { can } = usePermissions();
  const isWideDesktop = useIsWideDesktop();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<StockStatus | null>(
    initialStatusFilter
  );
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [moveStockOpen, setMoveStockOpen] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(
    bulkDeleteProducts,
    undefined
  );
  // Render-phase "adjust state when something changes" (not an effect) —
  // clears the selection once a bulk delete actually completes.
  const [handledDeleteState, setHandledDeleteState] = useState(deleteState);
  if (deleteState !== handledDeleteState) {
    setHandledDeleteState(deleteState);
    if (deleteState && "ok" in deleteState) {
      setSelected(new Set());
      setConfirmingDelete(false);
    }
  }

  // The actual fix for "deleting a product doesn't remove it from the
  // list": revalidatePath() in the server action only invalidates the
  // cache for the *next* request to /products — it never pushes anything
  // to this already-mounted tree. router.refresh() re-runs the route's
  // Server Components against that now-stale-marked cache, which is what
  // actually updates the `products` prop this table renders from. A real
  // effect (not the render-phase block above), since a router navigation
  // is a side effect, not a state update.
  useEffect(() => {
    if (deleteState && "ok" in deleteState) {
      router.refresh();
      const { deleted, deactivated } = deleteState;
      const parts: string[] = [];
      if (deleted > 0) parts.push(`${deleted} deleted`);
      if (deactivated > 0) parts.push(`${deactivated} deactivated`);
      toastManager.add({ title: parts.join(", ") || "Products removed", type: "success" });
    }
  }, [deleteState, router]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function openEdit(productId: string) {
    // Wider than the nav's own md (768px) breakpoint on purpose — a tablet
    // width has room for a full-width list OR a full-width panel, not both
    // at once. Below lg (1024px), row clicks fall back to the same
    // full-page edit route mobile uses; only lg+ gets the persistent panel.
    if (isWideDesktop) {
      onSelectProduct(productId);
    } else {
      router.push(`/products/${productId}/edit`);
    }
  }

  const allRows: Row[] = products.flatMap((product): Row[] =>
    product.variants.length > 0
      ? product.variants.map((variant) => ({ product, variant }))
      : [{ product, variant: null }]
  );

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const categoryItems: Record<string, string> = {
    [ALL_CATEGORIES]: "All categories",
    ...Object.fromEntries(categories.map((c) => [c, c])),
  };

  const searchQuery = search.trim().toLowerCase();
  const rows = allRows.filter(({ product, variant }) => {
    const status = getStockStatus(variant?.onHand ?? 0, product.isActive);
    if (statusFilter) {
      if (status !== statusFilter) return false;
      // A deleted-with-history product is deactivated, not removed (see
      // deleteProduct in products/actions.ts) — "All statuses" deliberately
      // excludes it, the same way it would disappear if it were actually
      // gone. It's still fully findable via the explicit "Inactive" filter.
    } else if (status === "inactive") {
      return false;
    }
    if (categoryFilter !== ALL_CATEGORIES && product.category !== categoryFilter) {
      return false;
    }
    if (searchQuery) {
      const haystack = [
        product.name,
        product.category,
        product.brand ?? "",
        variant?.name ?? "",
        variant?.sku ?? "",
        variant?.barcode ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }
    return true;
  });

  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name":
        cmp = variantLabel(a).localeCompare(variantLabel(b));
        break;
      case "sku":
        cmp = (a.variant?.sku ?? "").localeCompare(b.variant?.sku ?? "");
        break;
      case "stock":
        cmp = (a.variant?.onHand ?? 0) - (b.variant?.onHand ?? 0);
        break;
      case "price":
        cmp = (a.variant?.unitPrice ?? -1) - (b.variant?.unitPrice ?? -1);
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  // 10 per page, per the products list's pagination requirement — the same
  // usePagination/TablePagination pair the dashboard's tables already use.
  const { pageItems, page, totalPages, setPage, resetPage } =
    usePagination(sorted);

  // Bulk selection (selectedRows and friends below) intentionally stays
  // scoped to the full filtered set, not just the current page — a
  // selection made on page 1 must survive navigating to page 2. Only the
  // header "select all" checkbox is page-scoped (allVisibleSelected /
  // toggleAllVisible, further down): checking it should select what's
  // actually on screen, not silently reach into pages the user can't see.
  const selectedRows = sorted.filter((row) => selected.has(rowKey(row)));
  const selectedProductIds = [
    ...new Set(selectedRows.map((row) => row.product.id)),
  ];
  const selectedMoveVariants: MoveStockVariant[] = selectedRows
    .filter((row): row is { product: EditableProduct; variant: EditableVariant } =>
      row.variant != null
    )
    .map((row) => ({
      id: row.variant.id,
      label: variantLabel(row),
      onHand: row.variant.onHand,
    }));
  const productIdsJson = useMemo(
    () => JSON.stringify(selectedProductIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected]
  );

  const allVisibleSelected =
    pageItems.length > 0 && pageItems.every((row) => selected.has(rowKey(row)));
  const someVisibleSelected = pageItems.some((row) => selected.has(rowKey(row)));

  function toggleRow(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        for (const row of pageItems) next.delete(rowKey(row));
        return next;
      }
      const next = new Set(current);
      for (const row of pageItems) next.add(rowKey(row));
      return next;
    });
  }

  const hasActiveFilters =
    statusFilter != null || categoryFilter !== ALL_CATEGORIES || searchQuery !== "";

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            resetPage();
          }}
          placeholder="Search name, SKU, barcode, category…"
          className="max-w-xs"
        />
        <Select
          items={STATUS_ITEMS}
          value={statusFilter ?? ALL_STATUSES}
          onValueChange={(value) => {
            if (value == null) return;
            setStatusFilter(value === ALL_STATUSES ? null : (value as StockStatus));
            resetPage();
          }}
        >
          <SelectTrigger className="w-fit min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categories.length > 0 ? (
          <Select
            items={categoryItems}
            value={categoryFilter}
            onValueChange={(value) => {
              if (value == null) return;
              setCategoryFilter(value);
              resetPage();
            }}
          >
            <SelectTrigger className="w-fit min-w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(categoryItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter(null);
              setCategoryFilter(ALL_CATEGORIES);
              resetPage();
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {hasActiveFilters ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Showing {rows.length} of {allRows.length}
        </p>
      ) : null}

      {!priceSettings ? (
        <p className="mb-3 rounded-md bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          Price settings haven&apos;t been saved yet, so Retail Price and
          Wholesale Price can&apos;t be calculated below.{" "}
          <Link href="/settings" className="font-medium underline">
            Set price settings
          </Link>
        </p>
      ) : null}

      {selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm">
          <span className="px-1 font-medium">{selected.size} selected</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMoveStockOpen(true)}
            disabled={selectedMoveVariants.length === 0}
          >
            Move stock
          </Button>
          {can("products:delete") ? (
            !confirmingDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete selected
              </Button>
            ) : (
              <form action={deleteAction} className="flex items-center gap-2">
                <input type="hidden" name="productIds" value={productIdsJson} />
                <span className="text-muted-foreground">
                  Delete {selectedProductIds.length} product
                  {selectedProductIds.length === 1 ? "" : "s"}?
                </span>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={deletePending}
                >
                  {deletePending ? "Deleting…" : "Confirm"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deletePending}
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </Button>
              </form>
            )
          ) : null}
          <button
            type="button"
            onClick={() => {
              setSelected(new Set());
              setConfirmingDelete(false);
            }}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </button>
          {deleteState && "error" in deleteState ? (
            <p className="w-full text-xs text-destructive">{deleteState.error}</p>
          ) : null}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <p className="text-muted-foreground">No products match your filters</p>
      ) : (
      <>
      <p className="mb-1 text-xs text-muted-foreground sm:hidden">
        Scroll to see more →
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs">
              <th className="w-8 py-2 pl-1 font-medium">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected && !allVisibleSelected}
                  onCheckedChange={toggleAllVisible}
                  aria-label="Select all rows"
                />
              </th>
              <th className="w-10 py-2 font-medium" aria-hidden />
              <SortHeader
                label="Product"
                sortKey="name"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <th className="py-2 font-medium text-muted-foreground">
                SKU / barcode
              </th>
              <SortHeader
                label="Stock"
                sortKey="stock"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortHeader
                label="Unit price"
                sortKey="price"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <th className="py-2 pr-2 text-right font-medium text-muted-foreground">
                Pack/box price
              </th>
              {/* Retail/wholesale stay hidden below xl (1280px) — with the
                  side panel open, the list column is too narrow for 4 price
                  columns without cramping. Still editable any time via the
                  side panel's pricing section; visible here again once
                  there's room. */}
              <th className="hidden py-2 pr-2 text-right font-medium text-muted-foreground xl:table-cell">
                Retail price
              </th>
              <th className="hidden py-2 pr-2 text-right font-medium text-muted-foreground xl:table-cell">
                Wholesale price
              </th>
              <th className="py-2 pr-2 font-medium" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {pageItems.map(({ product, variant }) => {
              const status = getStockStatus(
                variant?.onHand ?? 0,
                product.isActive
              );
              const key = rowKey({ product, variant });
              const isSelected = selectedProductId === product.id;
              return (
                <tr
                  key={key}
                  onClick={() => openEdit(product.id)}
                  aria-selected={isSelected}
                  className={cn(
                    "cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/50",
                    isSelected && "bg-primary/5 hover:bg-primary/10"
                  )}
                >
                  <td className="py-3 pl-1" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(key)}
                      onCheckedChange={() => toggleRow(key)}
                      aria-label={`Select ${variantLabel({ product, variant })}`}
                    />
                  </td>
                  <td className="py-3 pr-2">
                    {product.imageUrl ? (
                      // Signed Storage URLs carry an expiring query string, so
                      // a plain <img> is used rather than next/image.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="size-9 rounded-md object-cover ring-1 ring-foreground/10"
                      />
                    ) : (
                      <div className="flex size-9 items-center justify-center rounded-md bg-muted ring-1 ring-foreground/10">
                        <ImageIcon className="size-4 text-muted-foreground" />
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-2">
                    <span className="block truncate font-medium">
                      {product.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {variant ? variant.name : "No variants"}
                    </span>
                  </td>
                  <td className="py-3 pr-2 text-xs text-muted-foreground">
                    <span className="block font-mono">
                      {variant?.sku ?? "—"}
                    </span>
                    {variant?.barcode ? (
                      <span className="block font-mono">{variant.barcode}</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-2 text-right">
                    <span className="flex flex-col items-end gap-0.5">
                      <span className="font-semibold tabular-nums">
                        {variant ? variant.onHand : "—"}
                      </span>
                      <StockStatusPill status={status} />
                    </span>
                  </td>
                  <td className="py-3 pr-2 text-right">
                    {moneyCell(variant?.unitPrice, variant?.currency)}
                  </td>
                  <td className="py-3 pr-2 text-right">
                    {moneyCell(variant?.packPrice, variant?.currency)}
                  </td>
                  <td className="hidden py-3 pr-2 text-right xl:table-cell">
                    {priceSettings
                      ? moneyCell(
                          applyPriceSettings(variant?.unitPrice ?? null, priceSettings),
                          variant?.currency
                        )
                      : moneyCell(undefined, undefined)}
                  </td>
                  <td className="hidden py-3 pr-2 text-right xl:table-cell">
                    {priceSettings
                      ? moneyCell(
                          applyPriceSettings(variant?.packPrice ?? null, priceSettings),
                          variant?.currency
                        )
                      : moneyCell(undefined, undefined)}
                  </td>
                  <td className="py-3 pr-2 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(product.id);
                      }}
                      className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 hover:bg-muted hover:text-foreground"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} totalPages={totalPages} onChange={setPage} />
      </>
      )}

      <MoveStockDialog
        open={moveStockOpen}
        onOpenChange={setMoveStockOpen}
        variants={selectedMoveVariants}
        locations={locations}
        onMoved={() => {
          setMoveStockOpen(false);
          setSelected(new Set());
        }}
      />
    </>
  );
}
