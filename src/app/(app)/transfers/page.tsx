import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import type { LocationOption, VariantOption } from "@/components/transfers/transfer-form";
import { NewTransferDialog } from "@/components/transfers/new-transfer-dialog";
import { RecentTransfersTable, type Transfer } from "@/components/transfers/recent-transfers-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TRANSFERS_PAGE_SIZE = 10;
// Every transfer is recorded as EXACTLY one TRANSFER_OUT + one TRANSFER_IN
// row sharing a reference_id, in a single transaction (record_stock_transfer
// — see actions.ts's own comment) — so a page of 10 transfers is always 20
// raw movement rows. Ordering by created_at desc keeps each pair adjacent
// (both rows are written together, in the same transaction, so there's
// nothing else that could interleave between them).
const MOVEMENTS_PER_TRANSFER = 2;

type VariantRow = {
  id: string;
  name: string;
  sku: string;
  products: { name: string } | null;
};

type TransferMovementRow = {
  reference_id: string | null;
  movement_type: string;
  quantity: number;
  created_at: string;
  locations: { name: string } | null;
  product_variants:
    | { name: string; products: { name: string } | null }
    | null;
};

function variantLabel(name: string, sku: string, productName?: string) {
  const base = productName ? `${productName} — ${name}` : name;
  return `${base} (${sku})`;
}

function groupTransfers(rows: TransferMovementRow[]): Transfer[] {
  const byReference = new Map<string, TransferMovementRow[]>();

  for (const row of rows) {
    if (!row.reference_id) continue;
    const group = byReference.get(row.reference_id) ?? [];
    group.push(row);
    byReference.set(row.reference_id, group);
  }

  return [...byReference.entries()].map(([referenceId, group]) => {
    const out = group.find((r) => r.movement_type === "TRANSFER_OUT");
    const incoming = group.find((r) => r.movement_type === "TRANSFER_IN");
    const sample = incoming ?? out ?? group[0];

    return {
      referenceId,
      createdAt: sample.created_at,
      quantity: Math.abs(
        incoming?.quantity ?? out?.quantity ?? sample.quantity
      ),
      variantLabel: sample.product_variants
        ? `${
            sample.product_variants.products?.name
              ? `${sample.product_variants.products.name} — `
              : ""
          }${sample.product_variants.name}`
        : "Unknown variant",
      source: out?.locations?.name ?? null,
      destination: incoming?.locations?.name ?? null,
    };
  });
}

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const requestedPage = Number((await searchParams).page);
  const page =
    Number.isFinite(requestedPage) && requestedPage > 1
      ? Math.floor(requestedPage)
      : 1;

  const supabase = await createClient();

  const rangeFrom = (page - 1) * TRANSFERS_PAGE_SIZE * MOVEMENTS_PER_TRANSFER;
  const rangeTo = rangeFrom + TRANSFERS_PAGE_SIZE * MOVEMENTS_PER_TRANSFER - 1;

  // All reads are RLS-scoped to the caller's organisation. transferRefsRes
  // fetches ONLY the reference_id column for every TRANSFER movement — not
  // the full row — purely to compute a DISTINCT transfer count server-side
  // (PostgREST's `count: "exact"` counts raw rows, not distinct values, and
  // there are 2 raw rows per transfer — see MOVEMENTS_PER_TRANSFER above);
  // transfersRes is the actual paginated window (.range()), with every
  // column the table needs.
  const [locationsRes, variantsRes, transferRefsRes, transfersRes] =
    await Promise.all([
      supabase
        .from("locations")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("product_variants")
        .select("id, name, sku, products(name)")
        .order("name")
        .returns<VariantRow[]>(),
      supabase
        .from("inventory_movements")
        .select("reference_id")
        .eq("reference_type", "TRANSFER")
        .returns<{ reference_id: string | null }[]>(),
      supabase
        .from("inventory_movements")
        .select(
          "reference_id, movement_type, quantity, created_at, locations(name), product_variants(name, products(name))"
        )
        .eq("reference_type", "TRANSFER")
        .order("created_at", { ascending: false })
        .range(rangeFrom, rangeTo)
        .returns<TransferMovementRow[]>(),
    ]);

  const firstError =
    locationsRes.error ||
    variantsRes.error ||
    transferRefsRes.error ||
    transfersRes.error;
  if (firstError) {
    throw firstError;
  }

  const locations: LocationOption[] = (locationsRes.data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
  }));

  const variants: VariantOption[] = (variantsRes.data ?? []).map((v) => ({
    id: v.id,
    label: variantLabel(v.name, v.sku, v.products?.name),
  }));

  const totalTransfers = new Set(
    (transferRefsRes.data ?? [])
      .map((r) => r.reference_id)
      .filter((id): id is string => id !== null)
  ).size;
  const totalPages = Math.max(
    1,
    Math.ceil(totalTransfers / TRANSFERS_PAGE_SIZE)
  );

  // Sliced to TRANSFERS_PAGE_SIZE as a safety net — the range() window
  // fetches exactly 2x that many raw rows on the assumption every pair is
  // contiguous (see MOVEMENTS_PER_TRANSFER's own comment); if a pair ever
  // did straddle the window boundary, grouping could momentarily surface
  // one extra partial entry, which this slice simply drops rather than
  // rendering a transfer with a missing source or destination.
  const transfers: Transfer[] = groupTransfers(transfersRes.data ?? []).slice(
    0,
    TRANSFERS_PAGE_SIZE
  );

  return (
    <div className="flex w-full flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title">Transfers</h1>
          <p className="text-page-subtitle">Move stock between locations.</p>
        </div>
        <NewTransferDialog locations={locations} variants={variants} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent transfers</CardTitle>
          <CardDescription>
            {totalTransfers > 0 ? `${totalTransfers} total` : "None yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecentTransfersTable
            transfers={transfers}
            page={page}
            totalPages={totalPages}
          />
        </CardContent>
      </Card>
    </div>
  );
}
