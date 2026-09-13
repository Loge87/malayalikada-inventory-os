import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { formatDateTime } from "@/lib/format";
import {
  TransferForm,
  type LocationOption,
  type VariantOption,
} from "@/components/transfers/transfer-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

type Transfer = {
  referenceId: string;
  createdAt: string;
  quantity: number;
  variantLabel: string;
  source: string | null;
  destination: string | null;
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

export default async function TransfersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // All reads are RLS-scoped to the caller's organisation.
  const [locationsRes, variantsRes, transfersRes] = await Promise.all([
    supabase.from("locations").select("id, name").order("name"),
    supabase
      .from("product_variants")
      .select("id, name, sku, products(name)")
      .order("name")
      .returns<VariantRow[]>(),
    supabase
      .from("inventory_movements")
      .select(
        "reference_id, movement_type, quantity, created_at, locations(name), product_variants(name, products(name))"
      )
      .eq("reference_type", "TRANSFER")
      .order("created_at", { ascending: false })
      .limit(40)
      .returns<TransferMovementRow[]>(),
  ]);

  const firstError =
    locationsRes.error || variantsRes.error || transfersRes.error;
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

  const transfers = groupTransfers(transfersRes.data ?? []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 md:p-10">
      <TransferForm locations={locations} variants={variants} />

      <Card>
        <CardHeader>
          <CardTitle>Recent transfers</CardTitle>
          <CardDescription>
            {transfers.length > 0
              ? `Last ${transfers.length}`
              : "None yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transfers.length > 0 ? (
            <ul className="divide-y divide-border">
              {transfers.map((transfer) => (
                <li
                  key={transfer.referenceId}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate">
                      {transfer.variantLabel}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {transfer.source ?? "?"} → {transfer.destination ?? "?"} ·{" "}
                      {formatDateTime(transfer.createdAt)}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {transfer.quantity}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No transfers yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
