"use server";

import { revalidatePath } from "next/cache";

import { MAX_CASES, MAX_LINES, readCart, writeCart } from "@/lib/cart";
import { loadItemsByCodes, loadItemsByIds, type StockState } from "@/lib/catalogue";
import { getCurrentRetailer, getPortalSettings, type Retailer } from "@/lib/portal";

export type BulkRow = { code: string; cases: number };

export type BulkLine = {
  code: string;
  requested: number;
  item: {
    id: string;
    name: string;
    variantName: string;
    sku: string;
    brand: string | null;
    imageUrl: string | null;
    unitsPerCase: number;
    currency: string;
    casePrice: number | null;
    available: number;
    stock: StockState;
  } | null;
};

export type BulkMatchResult = { ok: true; lines: BulkLine[] } | { ok: false; error: string };

const MAX_ROWS = 500;

async function approvedRetailer(): Promise<{ error: string } | { retailer: Retailer }> {
  const retailer = await getCurrentRetailer();
  if (!retailer) return { error: "Please sign in to place a quick order." };
  if (retailer.status !== "approved") return { error: "Your account must be approved before you can order." };
  return { retailer };
}

export async function matchBulk(rows: BulkRow[]): Promise<BulkMatchResult> {
  const auth = await approvedRetailer();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "No products found in that file." };
  if (rows.length > MAX_ROWS) return { ok: false, error: `Please upload at most ${MAX_ROWS} lines at a time.` };

  const cleaned = rows
    .map((r) => ({
      code: String(r.code ?? "").trim().slice(0, 80),
      cases: Math.min(Math.max(Math.floor(Number(r.cases) || 1), 1), MAX_CASES),
    }))
    .filter((r) => r.code);

  const settings = await getPortalSettings();
  const found = await loadItemsByCodes(cleaned.map((r) => r.code), settings, true);

  const lines: BulkLine[] = cleaned.map((r) => {
    const item = found.get(r.code.toLowerCase());
    return {
      code: r.code,
      requested: r.cases,
      item: item
        ? {
            id: item.id,
            name: item.name,
            variantName: item.variantName,
            sku: item.sku,
            brand: item.brand,
            imageUrl: item.imageUrl,
            unitsPerCase: item.unitsPerCase,
            currency: item.currency,
            casePrice: item.casePrice,
            available: item.casesAvailable ?? 0,
            stock: item.stock,
          }
        : null,
    };
  });
  return { ok: true, lines };
}

export type AddManyResult =
  | { ok: true; added: number; skipped: number }
  | { ok: false; error: string };

export async function addManyToCart(picks: { variantId: string; cases: number }[]): Promise<AddManyResult> {
  const auth = await approvedRetailer();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!Array.isArray(picks) || picks.length === 0) return { ok: false, error: "Select at least one product." };

  const settings = await getPortalSettings();
  const wanted = new Map<string, number>();
  for (const p of picks.slice(0, MAX_ROWS)) {
    const id = String(p.variantId ?? "").toLowerCase();
    const n = Math.floor(Number(p.cases));
    if (id && Number.isFinite(n) && n >= 1) wanted.set(id, (wanted.get(id) ?? 0) + n);
  }

  const items = await loadItemsByIds([...wanted.keys()], settings, true);
  const cart = await readCart();
  let added = 0;
  for (const item of items) {
    const available = item.casesAvailable ?? 0;
    if (available < 1 || item.casePrice === null) continue;
    const id = item.id.toLowerCase();
    const qty = Math.min(wanted.get(id) ?? 0, available);
    const existing = cart.find((l) => l.variantId === id);
    if (existing) existing.cases = Math.min(existing.cases + qty, MAX_CASES);
    else if (cart.length < MAX_LINES) cart.push({ variantId: id, cases: Math.min(qty, MAX_CASES) });
    else continue;
    added++;
  }
  if (added === 0) return { ok: false, error: "None of those products could be added. They may be out of stock." };

  await writeCart(cart);
  revalidatePath("/", "layout");
  return { ok: true, added, skipped: wanted.size - added };
}
