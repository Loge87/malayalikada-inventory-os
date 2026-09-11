"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Image as ImageIcon } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { ProductEditDrawer } from "@/components/products/product-edit-drawer";
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
  variants: EditableVariant[];
};

type Row = { product: EditableProduct; variant: EditableVariant | null };
type SortKey = "name" | "sku" | "stock" | "price";

function variantLabel(row: Row): string {
  return row.variant
    ? `${row.product.name} — ${row.variant.name}`
    : row.product.name;
}

function priceCell(variant: EditableVariant | null) {
  if (!variant || (variant.packPrice == null && variant.unitPrice == null)) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="flex flex-col text-right">
      {variant.unitPrice != null ? (
        <span>
          {formatMoney(variant.unitPrice, variant.currency)}/{variant.unit}
        </span>
      ) : null}
      {variant.packPrice != null ? (
        <span className="text-muted-foreground text-xs">
          {formatMoney(variant.packPrice, variant.currency)}/pack
        </span>
      ) : null}
    </span>
  );
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
}: {
  products: EditableProduct[];
  locations: LocationOption[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingProductId, setEditingProductId] = useState<string | null>(
    null
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const rows: Row[] = products.flatMap((product): Row[] =>
    product.variants.length > 0
      ? product.variants.map((variant) => ({ product, variant }))
      : [{ product, variant: null }]
  );

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

  const editingProduct =
    products.find((p) => p.id === editingProductId) ?? null;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="w-12 py-2 font-medium" aria-hidden />
              <SortHeader
                label="Product"
                sortKey="name"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortHeader
                label="SKU"
                sortKey="sku"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <th className="py-2 font-medium text-muted-foreground">
                Barcode
              </th>
              <SortHeader
                label="On hand"
                sortKey="stock"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortHeader
                label="Price"
                sortKey="price"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <th className="py-2 font-medium" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ product, variant }) => (
              <tr
                key={variant?.id ?? product.id}
                className="border-b border-border last:border-0"
              >
                <td className="py-2 pr-2">
                  {product.imageUrl ? (
                    // Signed Storage URLs carry an expiring query string, so a
                    // plain <img> is used rather than next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="size-10 rounded-md object-cover ring-1 ring-foreground/10"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-md bg-muted ring-1 ring-foreground/10">
                      <ImageIcon className="size-4 text-muted-foreground" />
                    </div>
                  )}
                </td>
                <td className="py-2 pr-2">
                  <span className="block truncate font-medium">
                    {product.name}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {variant ? variant.name : "No variants"}
                  </span>
                </td>
                <td className="py-2 pr-2 font-mono text-xs">
                  {variant?.sku ?? "—"}
                </td>
                <td className="py-2 pr-2 font-mono text-xs text-muted-foreground">
                  {variant?.barcode ?? "—"}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  {variant ? variant.onHand : "—"}
                </td>
                <td className="py-2 pr-2 tabular-nums">
                  {priceCell(variant)}
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setEditingProductId(product.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 hover:bg-muted hover:text-foreground"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ProductEditDrawer
        product={editingProduct}
        open={editingProduct != null}
        onOpenChange={(open) => {
          if (!open) setEditingProductId(null);
        }}
        locations={locations}
      />
    </>
  );
}
