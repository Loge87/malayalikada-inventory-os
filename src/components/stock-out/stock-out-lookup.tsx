"use client";

import { useCallback, useRef, useState } from "react";
import { XIcon } from "lucide-react";

import Link from "next/link";

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
import { Button } from "@/components/ui/button";
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
import { StockOutDialog } from "@/components/stock-out/stock-out-dialog";

export type LocationOption = { id: string; name: string };
export type ClientOption = { id: string; name: string };

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

/**
 * Same scan mechanics as ScanLookup (/scan) — barcode input, camera button,
 * lookup state machine, recent-scans history — with the read-only result
 * extended with a "Stock Out" button. Deliberately a separate component
 * rather than ScanLookup+props: the result card's content differs enough
 * (an action button and its own dialog state) that sharing would mean
 * threading stock-out-specific concerns through a component whose only job
 * elsewhere is read-only lookup. Price display itself (computeDisplayPrice)
 * is still the one shared call path every other site uses.
 */
export function StockOutLookup({
  myLocations,
  clients,
  pricing,
}: {
  /** Locations assigned to the CURRENT user (user_locations), active only —
   *  not every location in the org. Empty means this user can't stock out
   *  from anywhere yet. */
  myLocations: LocationOption[];
  clients: ClientOption[];
  pricing: PricingContext;
}) {
  const supabase = useRef(createClient()).current;
  const requestId = useRef(0);
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

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
      // "not found" here too.
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

  const found = lookup.state === "found" ? lookup : null;

  // Back to the pre-scan state — "Scan with camera" is primary again, the
  // Stock Out dialog's variant-keyed instance unmounts. Used both by the
  // result card's own explicit "Clear" and by a completed stock-out (see
  // StockOutDialog's onStockedOut below) — same reset either way.
  function clearResult() {
    setLookup({ state: "idle" });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle>Scan a barcode</CardTitle>
          {/* Shorter on mobile — this is chrome competing with the actual
              scan area for vertical space above the fold; the full
              explanation still shows from sm: up, where there's room. */}
          <CardDescription>
            <span className="sm:hidden">Scan, or type a barcode and press Enter.</span>
            <span className="hidden sm:inline">
              The field is always focused — scan with a hardware reader, or
              type a barcode and press Enter. On a phone, use the camera.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:gap-4">
          {/* Row on desktop (input takes the remaining space, the camera
              button sits beside it at its own natural width, not stretched
              full-width) — stacked, both full-width, on mobile (flex-col is
              the default; sm:flex-row only kicks in from that breakpoint
              up). The camera button's OWN open (video) state still forces
              itself to w-full regardless (see camera-scan-button.tsx), so
              it breaks onto its own line here via flex-wrap rather than
              being squeezed beside the input. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:gap-3">
            <div className="sm:min-w-64 sm:flex-1">
              <BarcodeInput onScan={handleScan} className="w-full" />
            </div>
            {/* Primary (solid) before anything's scanned — it's the only
                meaningful action available; secondary once a result is
                showing, since Stock Out (below) becomes the main action at
                that point. */}
            <CameraScanButton onScan={handleScan} emphasized={!found} />
          </div>
          <LookupResult
            lookup={lookup}
            pricing={pricing}
            canStockOut={myLocations.length > 0}
            onStockOut={() => setDialogOpen(true)}
            onClear={clearResult}
          />

          {found && myLocations.length === 0 ? (
            <p className="rounded-md bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
              You&apos;re not assigned to any location yet — ask an admin to
              assign one under Settings &gt; Team.
            </p>
          ) : null}
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

      {found ? (
        <StockOutDialog
          // Forces a fresh instance per distinct scanned variant, so a
          // quantity/client picked for one product never carries over to
          // the next one scanned.
          key={found.variant.id}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          variantId={found.variant.id}
          variantLabel={variantLabel(found.variant)}
          myLocations={myLocations}
          clients={clients}
          stockByLocationId={Object.fromEntries(
            found.variant.inventory_levels.map((l) => [l.location_id, l.on_hand])
          )}
          onStockedOut={clearResult}
        />
      ) : null}
    </div>
  );
}

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
  canStockOut,
  onStockOut,
  onClear,
}: {
  lookup: Lookup;
  pricing: PricingContext;
  /** False when the current user has no assigned locations at all (Stage 4
   *  point 4) — the button is disabled rather than opening a dialog that
   *  would just immediately error on submit. */
  canStockOut: boolean;
  onStockOut: () => void;
  /** Explicitly drops the current result back to the pre-scan state, so
   *  "Scan with camera" goes back to being the primary action without
   *  needing to actually scan something else first. */
  onClear: () => void;
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
  // whose parent product is soft-deleted.
  const isActive = true;
  const total = variant.inventory_levels.reduce((sum, l) => sum + l.on_hand, 0);
  const totalStatus = getStockStatus(total, isActive);
  // Same shared evaluateFormula call path (computeDisplayPrice) as every
  // other price display — live from this variant's current unit_price/
  // pack_price against the active formula, never a stale fallback.
  const retail = computeDisplayPrice(variant.unit_price, pricing.activeFormulas.retail, pricing.variables);
  const wholesale = computeDisplayPrice(variant.pack_price, pricing.activeFormulas.wholesale, pricing.variables);

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
      <div className="flex items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="block font-medium">{variantLabel(variant)}</span>
          <span className="text-muted-foreground text-xs">
            {variant.sku} · {variant.unit}
            {variant.products?.category ? ` · ${variant.products.category}` : ""}
            {source !== "scan" ? ` · ${SOURCE_LABEL[source]}` : ""}
          </span>
        </span>
        <div className="flex shrink-0 items-start gap-1">
          <span className="flex flex-col items-end gap-1">
            <span className="text-lg font-semibold tabular-nums">
              {total} <span className="text-sm font-normal text-muted-foreground">total</span>
            </span>
            <StockStatusPill status={totalStatus} />
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            aria-label="Clear result"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
        {retail.kind === "computed" ? (
          <span className="font-medium">
            {formatMoney(retail.amount, variant.currency)} retail
          </span>
        ) : (
          <span className="text-caption">No pricing formula set yet (retail)</span>
        )}
        {wholesale.kind === "computed" ? (
          <span>{formatMoney(wholesale.amount, variant.currency)} wholesale</span>
        ) : (
          <span className="text-caption">No pricing formula set yet (wholesale)</span>
        )}
      </div>
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

      <Button
        type="button"
        onClick={onStockOut}
        disabled={!canStockOut}
        className="w-full sm:w-fit"
      >
        Stock Out
      </Button>
    </div>
  );
}
