import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { daysUntil, formatDate, formatDateTime } from "@/lib/format";
import { LOW_STOCK_THRESHOLD, getStockStatus } from "@/lib/stock-status";
import { StockStatusPill } from "@/components/inventory/stock-status-pill";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const EXPIRY_WINDOW_DAYS = 30;

type VariantRef = {
  name: string;
  sku: string;
  products: { name: string } | null;
} | null;

type LevelRow = {
  on_hand: number;
  locations: { id: string; name: string } | null;
  product_variants: VariantRef;
};

type BatchRow = {
  id: string;
  batch_number: string;
  expiry_date: string;
  quantity_remaining: number;
  locations: { name: string } | null;
  product_variants: VariantRef;
};

type MovementRow = {
  id: string;
  movement_type: string;
  quantity: number;
  created_at: string;
  locations: { name: string } | null;
  product_variants: VariantRef;
};

function variantLabel(variant: VariantRef): string {
  if (!variant) return "Unknown variant";
  return variant.products?.name
    ? `${variant.products.name} — ${variant.name}`
    : variant.name;
}

function movementTypeLabel(type: string): string {
  const words = type.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function signed(quantity: number): string {
  return quantity > 0 ? `+${quantity}` : String(quantity);
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const expiryCutoff = new Date();
  expiryCutoff.setUTCDate(expiryCutoff.getUTCDate() + EXPIRY_WINDOW_DAYS);
  const expiryCutoffDate = expiryCutoff.toISOString().slice(0, 10);

  // Every read is RLS-scoped to the caller's organisation.
  const [locationsRes, levelsRes, batchesRes, movementsRes] = await Promise.all([
    supabase.from("locations").select("id, name").order("name"),
    supabase
      .from("inventory_levels")
      .select(
        "on_hand, locations(id, name), product_variants(name, sku, products(name))"
      )
      .returns<LevelRow[]>(),
    supabase
      .from("inventory_batches")
      .select(
        "id, batch_number, expiry_date, quantity_remaining, locations(name), product_variants(name, sku, products(name))"
      )
      .not("expiry_date", "is", null)
      .gt("quantity_remaining", 0)
      .lte("expiry_date", expiryCutoffDate)
      .order("expiry_date", { ascending: true })
      .returns<BatchRow[]>(),
    supabase
      .from("inventory_movements")
      .select(
        "id, movement_type, quantity, created_at, locations(name), product_variants(name, sku, products(name))"
      )
      .order("created_at", { ascending: false })
      .limit(15)
      .returns<MovementRow[]>(),
  ]);

  const firstError =
    locationsRes.error ||
    levelsRes.error ||
    batchesRes.error ||
    movementsRes.error;
  if (firstError) {
    throw firstError;
  }

  const locationList = locationsRes.data ?? [];
  const levels = levelsRes.data ?? [];
  const batches = batchesRes.data ?? [];
  const movements = movementsRes.data ?? [];

  // --- Stock by location -----------------------------------------------------
  const byLocation = new Map<
    string,
    { name: string; total: number; variants: { label: string; onHand: number }[] }
  >();
  // Seed with every location so ones with no stock still show.
  for (const location of locationList) {
    byLocation.set(location.id, { name: location.name, total: 0, variants: [] });
  }
  for (const row of levels) {
    if (!row.locations) continue;
    const entry = byLocation.get(row.locations.id) ?? {
      name: row.locations.name,
      total: 0,
      variants: [],
    };
    entry.total += row.on_hand;
    entry.variants.push({
      label: variantLabel(row.product_variants),
      onHand: row.on_hand,
    });
    byLocation.set(row.locations.id, entry);
  }
  const stockByLocation = [...byLocation.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  for (const location of stockByLocation) {
    location.variants.sort((a, b) => a.label.localeCompare(b.label));
  }

  // --- Low stock -----------------------------------------------------------
  const lowStock = levels
    .filter((row) => row.on_hand < LOW_STOCK_THRESHOLD)
    .map((row) => ({
      label: variantLabel(row.product_variants),
      location: row.locations?.name ?? "—",
      onHand: row.on_hand,
    }))
    .sort((a, b) => a.onHand - b.onHand);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 md:p-10">
      <div>
        <h1 className="font-heading text-xl font-medium">Dashboard</h1>
        <p className="text-muted-foreground text-sm">{user.email}</p>
      </div>

      {/* Stock by location */}
      <Card>
        <CardHeader>
          <CardTitle>Stock by location</CardTitle>
          <CardDescription>
            On-hand totals per location, with the per-variant breakdown.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {stockByLocation.length > 0 ? (
            stockByLocation.map((location) => (
              <div key={location.name} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between border-b border-border pb-1">
                  <span className="font-medium">{location.name}</span>
                  <span className="tabular-nums">
                    {location.total} on hand
                  </span>
                </div>
                {location.variants.length > 0 ? (
                  <ul className="flex flex-col">
                    {location.variants.map((variant, i) => (
                      <li
                        key={`${location.name}-${i}`}
                        className="flex items-center justify-between gap-4 py-1 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          {variant.label}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="font-medium tabular-nums">
                            {variant.onHand}
                          </span>
                          <StockStatusPill status={getStockStatus(variant.onHand)} />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground py-1 text-sm">
                    No stock
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No locations yet</p>
          )}
        </CardContent>
      </Card>

      {/* Low stock */}
      <Card>
        <CardHeader>
          <CardTitle>Low stock</CardTitle>
          <CardDescription>
            Variant / location pairs under {LOW_STOCK_THRESHOLD} on hand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lowStock.length > 0 ? (
            <ul className="divide-y divide-border">
              {lowStock.map((row, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{row.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {row.location}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-medium tabular-nums">{row.onHand}</span>
                    <StockStatusPill status={getStockStatus(row.onHand)} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              Everything is at or above {LOW_STOCK_THRESHOLD}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Expiring soon */}
      <Card>
        <CardHeader>
          <CardTitle>Expiring soon</CardTitle>
          <CardDescription>
            Batches with stock left, expiring within {EXPIRY_WINDOW_DAYS} days.
            Already-expired batches are highlighted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Variant</th>
                    <th className="py-2 pr-4 font-medium">Batch</th>
                    <th className="py-2 pr-4 font-medium">Location</th>
                    <th className="py-2 pr-4 font-medium">Expiry</th>
                    <th className="py-2 font-medium text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => {
                    const days = daysUntil(batch.expiry_date);
                    const expired = days < 0;
                    return (
                      <tr
                        key={batch.id}
                        className={
                          expired
                            ? "border-t border-border bg-destructive/10"
                            : "border-t border-border"
                        }
                      >
                        <td className="py-2 pr-4">
                          {variantLabel(batch.product_variants)}
                        </td>
                        <td className="py-2 pr-4">{batch.batch_number}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {batch.locations?.name ?? "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {formatDate(batch.expiry_date)}
                          <span
                            className={
                              expired
                                ? "block text-xs font-medium text-destructive"
                                : "block text-xs text-muted-foreground"
                            }
                          >
                            {expired ? `expired ${-days}d ago` : `in ${days}d`}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {batch.quantity_remaining}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Nothing expiring in the next {EXPIRY_WINDOW_DAYS} days
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            Last {movements.length} stock movements across all locations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length > 0 ? (
            <ul className="divide-y divide-border">
              {movements.map((movement) => (
                <li
                  key={movement.id}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate">
                      {variantLabel(movement.product_variants)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {movementTypeLabel(movement.movement_type)} ·{" "}
                      {movement.locations?.name ?? "—"} ·{" "}
                      {formatDateTime(movement.created_at)}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {signed(movement.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No movements recorded yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
