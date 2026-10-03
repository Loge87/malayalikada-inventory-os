"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { getStockStatus } from "@/lib/stock-status";
import { computeDisplayPrice, type PricingContext } from "@/lib/price-formula";
import {
  findActiveVariantsByBarcode,
  type BarcodeMatchVariant,
} from "@/lib/product-lookup";
import { BarcodeInput } from "@/components/barcode/barcode-input";
import { CameraScanButton } from "@/components/barcode/camera-scan-button";
import type { ScanSource } from "@/components/barcode/types";
import { buttonVariants } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StockStatusPill } from "@/components/inventory/stock-status-pill";

const RECENT_SCANS_LIMIT = 10;

type InventoryLevel = {
  on_hand: number;
  locations: { name: string; type: string } | null;
};

type Lookup =
  | { state: "idle" }
  | { state: "loading"; barcode: string }
  | {
      state: "found";
      barcode: string;
      source: ScanSource;
      variant: BarcodeMatchVariant;
    }
  | { state: "not_found"; barcode: string }
  | { state: "ambiguous"; barcode: string }
  | { state: "error"; barcode: string; message: string };

type HistoryEntry = {
  key: number;
  barcode: string;
  source: ScanSource;
  outcome: "found" | "not_found" | "ambiguous" | "error";
  label: string;
};

export function ScanLookup({
  pricing,
}: {
  /** The organisation's active price formulas + the variables they
   *  reference — drives the found variant's calculated Retail/Wholesale
   *  price (one shared evaluateFormula call via computeDisplayPrice). */
  pricing: PricingContext;
}) {
  const supabase = useRef(createClient()).current;
  const requestId = useRef(0);
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const handleScan = useCallback(async function handleScan(
    barcode: string,
    source: ScanSource
  ) {
    const id = ++requestId.current;
    setLookup({ state: "loading", barcode });

    let data: BarcodeMatchVariant[] | null = null;
    let error: { message: string } | null = null;
    try {
      // findActiveVariantsByBarcode (lib/product-lookup.ts) is the one
      // shared query /scan, /stock-out, and the duplicate-check all use —
      // it excludes variants whose parent product is soft-deleted, so a
      // barcode that only belongs to a discontinued product reports
      // "not found" here too, not a stale card for a product that's gone.
      data = await findActiveVariantsByBarcode(supabase, barcode);
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
    }

    if (id !== requestId.current) return; // superseded by a newer scan

    let next: Lookup;
    let entry: HistoryEntry;
    if (error) {
      next = { state: "error", barcode, message: error.message };
      entry = { key: id, barcode, source, outcome: "error", label: error.message };
    } else if (!data || data.length === 0) {
      next = { state: "not_found", barcode };
      entry = { key: id, barcode, source, outcome: "not_found", label: "No match" };
    } else if (data.length > 1) {
      next = { state: "ambiguous", barcode };
      entry = {
        key: id,
        barcode,
        source,
        outcome: "ambiguous",
        label: "Multiple matches",
      };
    } else {
      const variant = data[0];
      next = { state: "found", barcode, source, variant };
      entry = {
        key: id,
        barcode,
        source,
        outcome: "found",
        label: variantLabel(variant),
      };
    }

    setLookup(next);
    setHistory((current) => [entry, ...current].slice(0, RECENT_SCANS_LIMIT));
  },
  [supabase]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Scan a barcode</CardTitle>
          <CardDescription>
            The field is always focused — scan with a hardware reader, or type a
            barcode and press Enter. On a phone, use the camera.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <BarcodeInput onScan={handleScan} />
          <CameraScanButton onScan={handleScan} />
          <LookupResult lookup={lookup} pricing={pricing} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Accordion>
            <AccordionItem value="recent-scans">
              <AccordionTrigger>
                Recent scans
                {history.length > 0 ? ` (${history.length})` : ""}
              </AccordionTrigger>
              <AccordionContent>
                {history.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {history.map((h) => (
                      <li
                        key={h.key}
                        className="flex items-center justify-between gap-4 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-xs">
                            {h.barcode}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {SOURCE_LABEL[h.source]} · {h.label}
                          </span>
                        </span>
                        <span
                          className={
                            h.outcome === "found"
                              ? "text-muted-foreground text-xs"
                              : "text-destructive text-xs"
                          }
                        >
                          {h.outcome}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No scans yet</p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

function variantLabel(variant: BarcodeMatchVariant): string {
  return variant.products?.name
    ? `${variant.products.name} — ${variant.name}`
    : variant.name;
}

const SOURCE_LABEL: Record<ScanSource, string> = {
  scan: "scanned",
  manual: "typed",
  camera: "camera",
};

/** One row of the store/warehouse breakdown table. */
function LevelRow({ level, isActive }: { level: InventoryLevel; isActive: boolean }) {
  return (
    <tr className="border-t border-border transition-colors hover:bg-muted/40">
      <td className="py-1.5 pr-4">{level.locations?.name ?? "Unknown location"}</td>
      <td className="py-1.5 pr-4 text-right font-medium tabular-nums">
        {level.on_hand}
      </td>
      <td className="py-1.5">
        <StockStatusPill status={getStockStatus(level.on_hand, isActive)} />
      </td>
    </tr>
  );
}

/** A group heading row (spans the table) — "Warehouse" / "Stores" / "Other". */
function GroupHeadingRow({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={3}
        className="pt-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase first:pt-1"
      >
        {label}
      </td>
    </tr>
  );
}

function LookupResult({
  lookup,
  pricing,
}: {
  lookup: Lookup;
  pricing: PricingContext;
}) {
  if (lookup.state === "idle") {
    return (
      <p className="text-muted-foreground text-sm">Waiting for a scan…</p>
    );
  }
  if (lookup.state === "loading") {
    return (
      <p className="text-muted-foreground text-sm">
        Looking up {lookup.barcode}…
      </p>
    );
  }
  if (lookup.state === "not_found") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-4 text-center">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">No product found</p>
          <p className="font-mono text-base">{lookup.barcode}</p>
          <p className="text-muted-foreground text-xs">
            This barcode isn&apos;t linked to any product variant yet.
          </p>
        </div>
        <Link
          href={`/products/new?barcode=${encodeURIComponent(lookup.barcode)}&returnTo=%2Fscan`}
          className={buttonVariants({ size: "sm" })}
        >
          Create new product
        </Link>
      </div>
    );
  }
  if (lookup.state === "ambiguous") {
    return (
      <p className="text-sm text-destructive">
        Barcode <span className="font-mono">{lookup.barcode}</span> matches more
        than one product variant.
      </p>
    );
  }
  if (lookup.state === "error") {
    return <p className="text-sm text-destructive">{lookup.message}</p>;
  }

  const { variant, source } = lookup;
  // Always true — findActiveVariantsByBarcode already excludes anything
  // whose parent product is soft-deleted, so a "found" result here can
  // never be an inactive product's stale card.
  const isActive = true;
  const total = variant.inventory_levels.reduce((sum, l) => sum + l.on_hand, 0);
  const totalStatus = getStockStatus(total, isActive);
  // Retail computes live from unit_price using the active Retail formula;
  // wholesale from pack_price using the active Wholesale formula — same
  // shared evaluateFormula call path (computeDisplayPrice) every other
  // price display uses. pack_price itself is shown as-is below, not run
  // through either formula.
  const retail = computeDisplayPrice(variant.unit_price, pricing.activeFormulas.retail, pricing.variables);
  const wholesale = computeDisplayPrice(variant.pack_price, pricing.activeFormulas.wholesale, pricing.variables);
  const retailPrice = retail.kind === "computed" ? retail.amount : null;
  const wholesalePrice = wholesale.kind === "computed" ? wholesale.amount : null;

  const byType = (type: string) =>
    variant.inventory_levels
      .filter((l) => l.locations?.type === type)
      .sort((a, b) => (a.locations?.name ?? "").localeCompare(b.locations?.name ?? ""));
  const warehouseLevels = byType("warehouse");
  const storeLevels = byType("store");
  const otherLevels = variant.inventory_levels
    .filter((l) => l.locations?.type !== "warehouse" && l.locations?.type !== "store")
    .sort((a, b) => (a.locations?.name ?? "").localeCompare(b.locations?.name ?? ""));

  return (
    <div className="flex flex-col gap-3 rounded-lg ring-1 ring-foreground/10 p-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="min-w-0">
          <span className="block font-medium">{variantLabel(variant)}</span>
          <span className="text-muted-foreground text-xs">
            {variant.sku} · {variant.unit}
            {variant.products?.category ? ` · ${variant.products.category}` : ""}
            {source !== "scan" ? ` · ${SOURCE_LABEL[source]}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-lg font-semibold tabular-nums">
            {total} <span className="text-sm font-normal text-muted-foreground">total</span>
          </span>
          <StockStatusPill status={totalStatus} />
        </span>
      </div>

      {retailPrice != null ||
      variant.pack_price != null ||
      wholesalePrice != null ||
      variant.unit_price != null ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
          {retail.kind === "computed" ? (
            <span className="font-medium">
              {formatMoney(retail.amount, variant.currency)} retail
            </span>
          ) : (
            <span className="text-caption">No pricing formula set yet (retail)</span>
          )}
          {variant.pack_price != null ? (
            <span>
              {formatMoney(variant.pack_price, variant.currency)} / pack
              {variant.units_per_pack !== 1
                ? ` (${variant.units_per_pack} ${variant.unit})`
                : ""}
            </span>
          ) : null}
          {wholesale.kind === "computed" ? (
            <span>{formatMoney(wholesale.amount, variant.currency)} wholesale</span>
          ) : (
            <span className="text-caption">No pricing formula set yet (wholesale)</span>
          )}
          {variant.unit_price != null ? (
            <span className="text-muted-foreground">
              {formatMoney(variant.unit_price, variant.currency)} /{" "}
              {variant.unit}
            </span>
          ) : null}
        </div>
      ) : null}
      {retail.kind === "not_set" && wholesale.kind === "not_set" ? (
        <p className="text-xs text-muted-foreground">
          <Link href="/settings?tab=price-settings" className="underline">
            Set up pricing
          </Link>{" "}
          to see retail and wholesale price.
        </p>
      ) : null}

      {variant.inventory_levels.length > 0 ? (
        <div className="overflow-x-auto border-t border-border pt-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="pt-2 pb-1 pr-4 font-medium">Location</th>
                <th className="pt-2 pb-1 pr-4 text-right font-medium">On hand</th>
                <th className="pt-2 pb-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {warehouseLevels.length > 0 ? (
                <>
                  <GroupHeadingRow label="Warehouse" />
                  {warehouseLevels.map((level, i) => (
                    <LevelRow key={`w-${i}`} level={level} isActive={isActive} />
                  ))}
                </>
              ) : null}
              {storeLevels.length > 0 ? (
                <>
                  <GroupHeadingRow label="Stores" />
                  {storeLevels.map((level, i) => (
                    <LevelRow key={`s-${i}`} level={level} isActive={isActive} />
                  ))}
                </>
              ) : null}
              {otherLevels.length > 0 ? (
                <>
                  <GroupHeadingRow label="Other" />
                  {otherLevels.map((level, i) => (
                    <LevelRow key={`o-${i}`} level={level} isActive={isActive} />
                  ))}
                </>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">No stock recorded</p>
      )}
    </div>
  );
}
