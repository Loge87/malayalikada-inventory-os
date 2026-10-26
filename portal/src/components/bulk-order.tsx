"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { addManyToCart, matchBulk, type BulkLine, type BulkRow } from "@/app/bulk-actions";
import { ProductImage } from "@/components/product-image";
import { QtyControl } from "@/components/qty-control";
import { formatMoney } from "@/lib/money";

const MAX_BYTES = 5 * 1024 * 1024;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === ";" || c === "\t") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Turns spreadsheet rows into {code, cases}. Understands an optional header row. */
function toBulkRows(data: unknown[][]): BulkRow[] {
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
  const grid = data.filter((r) => r.some((c) => str(c) !== ""));
  if (grid.length === 0) return [];

  let codeCol = 0;
  let qtyCol = 1;
  let start = 0;
  const first = grid[0].map((c) => str(c).toLowerCase());
  const isHeader = first.some((c) => /^(sku|code|barcode|item|product|qty|quantity|cases?)\b/.test(c)) && !first.some((c) => /^\d+$/.test(c) && c.length > 6);
  if (isHeader) {
    start = 1;
    const code = first.findIndex((c) => /sku|code|barcode/.test(c));
    const alt = first.findIndex((c) => /item|product/.test(c));
    codeCol = code >= 0 ? code : alt >= 0 ? alt : 0;
    const qty = first.findIndex((c) => /case|qty|quantity|order/.test(c));
    qtyCol = qty >= 0 ? qty : codeCol === 0 ? 1 : 0;
  }

  const merged = new Map<string, BulkRow>();
  for (const r of grid.slice(start)) {
    const code = str(r[codeCol]);
    if (!code) continue;
    const n = Math.floor(Number(str(r[qtyCol]).replace(/[^0-9.]/g, "")));
    const cases = Number.isFinite(n) && n >= 1 ? n : 1;
    const key = code.toLowerCase();
    const prev = merged.get(key);
    merged.set(key, { code: prev?.code ?? code, cases: (prev?.cases ?? 0) + cases });
  }
  return [...merged.values()];
}

async function readFile(file: File): Promise<BulkRow[]> {
  const name = file.name.toLowerCase();
  if (file.size > MAX_BYTES) throw new Error("That file is too large. Please keep it under 5 MB.");
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const data = (await readSheet(file)) as unknown[][];
    return toBulkRows(data);
  }
  if (name.endsWith(".csv") || name.endsWith(".txt")) return toBulkRows(parseCsv(await file.text()));
  if (name.endsWith(".xls")) throw new Error("Old .xls files are not supported. Please save it as .xlsx or .csv and try again.");
  throw new Error("Please upload an Excel (.xlsx) or CSV file.");
}

function downloadTemplate() {
  const csv = "sku,cases\nSKU-001,2\nSKU-002,5\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "bulk-order-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type Pick = { checked: boolean; cases: number };

const STATUS = {
  in: { label: "In stock", cls: "bg-brand/10 text-brand" },
  low: { label: "Low stock", cls: "bg-accent/15 text-[#a15f06]" },
  out: { label: "Out of stock", cls: "bg-danger/10 text-danger" },
} as const;

export function BulkOrder() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, startMatch] = useTransition();
  const [adding, startAdd] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lines, setLines] = useState<BulkLine[] | null>(null);
  const [picks, setPicks] = useState<Record<string, Pick>>({});

  const orderable = (l: BulkLine) => Boolean(l.item && l.item.available >= 1 && l.item.casePrice !== null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const rows = await readFile(file);
      if (rows.length === 0) throw new Error("We could not find any products in that file. Use one column for the SKU or barcode and one for the cases.");
      setFileName(file.name);
      startMatch(async () => {
        const res = await matchBulk(rows);
        if (!res.ok) { setError(res.error); return; }
        const next: Record<string, Pick> = {};
        for (const l of res.lines) {
          if (l.item) next[l.item.id] = { checked: orderable(l), cases: Math.max(1, Math.min(l.requested, l.item.available || 1)) };
        }
        setPicks(next);
        setLines(res.lines);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    }
  }

  function reset() {
    setLines(null); setPicks({}); setFileName(null); setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const found = useMemo(() => (lines ?? []).filter((l) => l.item), [lines]);
  const missing = useMemo(() => (lines ?? []).filter((l) => !l.item), [lines]);
  const selectable = found.filter(orderable);
  const selected = selectable.filter((l) => picks[l.item!.id]?.checked);
  const allSelected = selectable.length > 0 && selected.length === selectable.length;
  const currency = found[0]?.item?.currency ?? "NZD";
  const total = selected.reduce((s, l) => s + (l.item!.casePrice ?? 0) * (picks[l.item!.id]?.cases ?? 0), 0);

  function toggleAll() {
    setPicks((p) => {
      const n = { ...p };
      for (const l of selectable) n[l.item!.id] = { ...n[l.item!.id], checked: !allSelected };
      return n;
    });
  }

  function addSelected() {
    setError(null);
    startAdd(async () => {
      const res = await addManyToCart(selected.map((l) => ({ variantId: l.item!.id, cases: picks[l.item!.id].cases })));
      if (!res.ok) { setError(res.error); return; }
      router.push("/cart");
      router.refresh();
    });
  }

  if (!lines) {
    return (
      <div className="mx-auto max-w-2xl">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files[0]); }}
          className={`card flex flex-col items-center gap-4 border-2 border-dashed p-10 text-center transition-colors sm:p-14 ${dragging ? "border-brand bg-brand/5" : "border-line"}`}
        >
          <div className="grid size-16 place-items-center rounded-3xl bg-brand/10 text-3xl" aria-hidden>📄</div>
          <div>
            <h2 className="text-xl font-bold">{busy ? "Checking stock…" : "Upload your product list"}</h2>
            <p className="mt-1 text-sm text-muted">
              Drop an Excel (.xlsx) or CSV file here. Use one column for the SKU or barcode and one for the number of cases.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,.txt"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? "Please wait…" : "Choose file"}
            </button>
            <button type="button" className="btn" onClick={downloadTemplate}>Download template</button>
          </div>
          {error ? <p className="text-sm font-medium text-danger" role="alert">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{fileName}</p>
          <p className="text-sm text-muted">
            {found.length} matched · {selectable.length} available to order{missing.length ? ` · ${missing.length} not found` : ""}
          </p>
        </div>
        <button type="button" className="btn btn-sm" onClick={reset}>Upload another file</button>
      </div>

      <div className="card overflow-hidden">
        <label className="flex items-center gap-3 border-b border-line bg-soft px-5 py-3 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={allSelected} onChange={toggleAll} disabled={selectable.length === 0} />
          Select all available ({selectable.length})
        </label>
        <ul className="divide-y divide-line">
          {found.map((l) => {
            const it = l.item!;
            const ok = orderable(l);
            const pick = picks[it.id];
            const st = STATUS[it.available < 1 ? "out" : it.stock];
            const short = ok && l.requested > it.available;
            return (
              <li key={it.id} className={`flex flex-wrap items-center gap-4 px-5 py-4 ${ok ? "" : "bg-soft/60"}`}>
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--brand)]"
                  disabled={!ok}
                  checked={Boolean(pick?.checked) && ok}
                  onChange={(e) => setPicks((p) => ({ ...p, [it.id]: { ...p[it.id], checked: e.target.checked } }))}
                  aria-label={`Select ${it.name}`}
                />
                <div className="product-media size-14 shrink-0 overflow-hidden rounded-xl">
                  <ProductImage src={it.imageUrl} alt={it.name} />
                </div>
                <div className="min-w-0 flex-1 basis-48">
                  <div className="truncate font-semibold">{it.name}</div>
                  <div className="text-sm text-muted">{it.variantName} · {it.sku}</div>
                  {short ? <div className="text-xs font-medium text-[#a15f06]">You asked for {l.requested}, only {it.available} available</div> : null}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>
                  {st.label}{it.available >= 1 ? ` · ${it.available} ${it.available === 1 ? "case" : "cases"}` : ""}
                </span>
                {ok ? (
                  <>
                    <QtyControl value={pick?.cases ?? 1} max={it.available} onChange={(n) => setPicks((p) => ({ ...p, [it.id]: { ...p[it.id], cases: n } }))} />
                    <div className="w-24 text-right font-bold">{formatMoney((it.casePrice ?? 0) * (pick?.cases ?? 1), it.currency)}</div>
                  </>
                ) : (
                  <div className="text-sm text-muted">{it.casePrice === null && it.available >= 1 ? "No price set" : "Unavailable"}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {missing.length > 0 ? (
        <div className="rounded-2xl border border-line bg-white p-5">
          <h3 className="font-bold">Not found ({missing.length})</h3>
          <p className="mt-1 text-sm text-muted">We could not match these to a product on the portal:</p>
          <p className="mt-2 text-sm">{missing.map((m) => m.code).join(", ")}</p>
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-danger" role="alert">{error}</p> : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <div className="font-bold">{selected.length} selected</div>
            <div className="text-sm text-muted">Total {formatMoney(total, currency)}</div>
          </div>
          <div className="flex gap-3">
            <Link href="/cart" className="btn">View cart</Link>
            <button type="button" className="btn btn-primary" disabled={selected.length === 0 || adding} onClick={addSelected}>
              {adding ? "Adding…" : `Add ${selected.length} to cart`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
