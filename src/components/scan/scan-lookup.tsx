"use client";

import { useCallback, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { BarcodeInput } from "@/components/barcode/barcode-input";
import { CameraScanButton } from "@/components/barcode/camera-scan-button";
import type { ScanSource } from "@/components/barcode/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Variant = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  products: { name: string; category: string | null } | null;
  inventory_levels: { on_hand: number; locations: { name: string } | null }[];
};

type Lookup =
  | { state: "idle" }
  | { state: "loading"; barcode: string }
  | { state: "found"; barcode: string; source: ScanSource; variant: Variant }
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

export function ScanLookup() {
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

    const { data, error } = await supabase
      .from("product_variants")
      .select(
        "id, name, sku, barcode, unit, products(name, category), inventory_levels(on_hand, locations(name))"
      )
      .eq("barcode", barcode)
      .limit(2)
      .returns<Variant[]>();

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
    setHistory((current) => [entry, ...current].slice(0, 8));
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
          <LookupResult lookup={lookup} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent scans</CardTitle>
          <CardDescription>
            {history.length > 0 ? `Last ${history.length}` : "None yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}

function variantLabel(variant: Variant): string {
  return variant.products?.name
    ? `${variant.products.name} — ${variant.name}`
    : variant.name;
}

const SOURCE_LABEL: Record<ScanSource, string> = {
  scan: "scanned",
  manual: "typed",
  camera: "camera",
};

function LookupResult({ lookup }: { lookup: Lookup }) {
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
      <p className="text-sm text-destructive">
        No product variant with barcode{" "}
        <span className="font-mono">{lookup.barcode}</span>.
      </p>
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
  const total = variant.inventory_levels.reduce((sum, l) => sum + l.on_hand, 0);

  return (
    <div className="flex flex-col gap-2 rounded-lg ring-1 ring-foreground/10 p-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="min-w-0">
          <span className="block font-medium">{variantLabel(variant)}</span>
          <span className="text-muted-foreground text-xs">
            {variant.sku} · {variant.unit}
            {variant.products?.category ? ` · ${variant.products.category}` : ""}
            {source !== "scan" ? ` · ${SOURCE_LABEL[source]}` : ""}
          </span>
        </span>
        <span className="shrink-0 tabular-nums">{total} on hand</span>
      </div>

      {variant.inventory_levels.length > 0 ? (
        <ul className="divide-y divide-border border-t border-border">
          {variant.inventory_levels
            .slice()
            .sort((a, b) =>
              (a.locations?.name ?? "").localeCompare(b.locations?.name ?? "")
            )
            .map((level, i) => (
              <li
                key={i}
                className="flex items-center justify-between py-1 text-sm"
              >
                <span>{level.locations?.name ?? "Unknown location"}</span>
                <span className="tabular-nums text-muted-foreground">
                  {level.on_hand}
                </span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">No stock recorded</p>
      )}
    </div>
  );
}
