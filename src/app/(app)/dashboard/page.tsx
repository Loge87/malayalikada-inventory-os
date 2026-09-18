import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Package,
  TrendingDown,
  Wallet,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { loadProducts } from "@/app/(app)/products/data";
import { formatMoney } from "@/lib/format";
import { LOW_STOCK_THRESHOLD, getStockStatus } from "@/lib/stock-status";
import { movementBucket, type MovementBucket } from "@/lib/movement-types";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  StockActivityChart,
  type ActivityDay,
} from "@/components/dashboard/stock-activity-chart";
import { RevenueChart, type RevenueDay } from "@/components/dashboard/revenue-chart";
import {
  LocationSummaryTable,
  type LocationSummaryRow,
} from "@/components/dashboard/location-summary-table";
import { LowStockTable, type LowStockRow } from "@/components/dashboard/low-stock-table";
import {
  ExpiringSoonTable,
  type ExpiringSoonRow,
} from "@/components/dashboard/expiring-soon-table";
import {
  RecentActivityFeed,
  type ActivityRow,
} from "@/components/dashboard/recent-activity-feed";

const EXPIRY_WINDOW_DAYS = 30;
const ACTIVITY_WINDOW_DAYS = 90;
// A pragmatic cap on the 90-day movements fetch — comfortably above what a
// single-store MVP tenant generates in that window. A tenant that blows past
// this needs server-side aggregation (a view/RPC), not a bigger constant.
const MOVEMENTS_FETCH_CAP = 3000;

type VariantRef = {
  name: string;
  sku: string;
  unit_price: number | null;
  currency: string;
  products: { name: string } | null;
} | null;

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

type LevelRow = {
  on_hand: number;
  location_id: string;
  product_variant_id: string;
  product_variants: {
    unit_price: number | null;
    currency: string;
    products: { is_active: boolean } | null;
  } | null;
};

function variantLabel(variant: VariantRef): string {
  if (!variant) return "Unknown variant";
  return variant.products?.name
    ? `${variant.products.name} — ${variant.name}`
    : variant.name;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const expiryCutoff = new Date();
  expiryCutoff.setUTCDate(expiryCutoff.getUTCDate() + EXPIRY_WINDOW_DAYS);
  const expiryCutoffDate = expiryCutoff.toISOString().slice(0, 10);

  const activityWindowStart = new Date();
  activityWindowStart.setUTCDate(
    activityWindowStart.getUTCDate() - ACTIVITY_WINDOW_DAYS
  );

  // Every read is RLS-scoped to the caller's organisation.
  const [products, locationsRes, levelsRes, batchesRes, movementsRes] =
    await Promise.all([
      loadProducts(supabase),
      supabase.from("locations").select("id, name").order("name"),
      supabase
        .from("inventory_levels")
        .select(
          "on_hand, location_id, product_variant_id, product_variants(unit_price, currency, products(is_active))"
        )
        .returns<LevelRow[]>(),
      supabase
        .from("inventory_batches")
        .select(
          "id, batch_number, expiry_date, quantity_remaining, locations(name), product_variants(name, sku, unit_price, currency, products(name))"
        )
        .not("expiry_date", "is", null)
        .gt("quantity_remaining", 0)
        .lte("expiry_date", expiryCutoffDate)
        .order("expiry_date", { ascending: true })
        .returns<BatchRow[]>(),
      supabase
        .from("inventory_movements")
        .select(
          "id, movement_type, quantity, created_at, locations(name), product_variants(name, sku, unit_price, currency, products(name))"
        )
        .gte("created_at", activityWindowStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(MOVEMENTS_FETCH_CAP)
        .returns<MovementRow[]>(),
    ]);

  const firstError =
    locationsRes.error || levelsRes.error || batchesRes.error || movementsRes.error;
  if (firstError) {
    throw firstError;
  }

  const locationList = locationsRes.data ?? [];
  const levels = levelsRes.data ?? [];
  const batches = batchesRes.data ?? [];
  const movements = movementsRes.data ?? [];

  // --- Stat cards: SKU count, stock value, low/out-of-stock counts --------
  // Flattened from loadProducts (the same product+variant+onHand shape
  // /products uses) rather than inventory_levels directly, so a variant with
  // zero stock and no movements yet still counts as a SKU / out-of-stock row
  // — inventory_levels only has a row once something has moved.
  const flatVariants = products.flatMap((product) =>
    product.variants.map((variant) => ({
      productId: product.id,
      productName: product.name,
      category: product.category,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      variantId: variant.id,
      variantName: variant.name,
      currency: variant.currency,
      unitPrice: variant.unitPrice,
      onHand: variant.onHand,
      status: getStockStatus(variant.onHand, product.isActive),
    }))
  );

  const totalSkus = flatVariants.filter((v) => v.isActive).length;

  const stockValueByCurrency = new Map<string, number>();
  for (const v of flatVariants) {
    if (v.unitPrice == null) continue;
    stockValueByCurrency.set(
      v.currency,
      (stockValueByCurrency.get(v.currency) ?? 0) + v.onHand * v.unitPrice
    );
  }
  const currencyValueEntries = [...stockValueByCurrency.entries()].sort(
    (a, b) => b[1] - a[1]
  );

  const lowStockCount = flatVariants.filter((v) => v.status === "low_stock").length;
  const outOfStockCount = flatVariants.filter(
    (v) => v.status === "out_of_stock"
  ).length;

  // Not capped here — LowStockTable paginates the full set itself.
  const lowStockRows: LowStockRow[] = flatVariants
    .filter((v) => v.status === "low_stock" || v.status === "out_of_stock")
    .sort((a, b) => a.onHand - b.onHand)
    .map((v) => ({
      productId: v.productId,
      variantId: v.variantId,
      name: `${v.productName} — ${v.variantName}`,
      category: v.category,
      imageUrl: v.imageUrl,
      onHand: v.onHand,
      unitPrice: v.unitPrice,
      currency: v.currency,
      status: v.status,
    }));

  // --- Per-location summary table ------------------------------------------
  // Same stock-value calculation as the top stat card (grouped by currency,
  // never converted) and the same getStockStatus classification as the
  // low-stock table — just scoped to each location's own levels rows instead
  // of the cross-location aggregate.
  const locationAggregates = new Map<
    string,
    {
      valueByCurrency: Map<string, number>;
      totalSkus: number;
      outOfStockCount: number;
      lowStockCount: number;
    }
  >();
  for (const location of locationList) {
    locationAggregates.set(location.id, {
      valueByCurrency: new Map(),
      totalSkus: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
    });
  }
  for (const row of levels) {
    const aggregate = locationAggregates.get(row.location_id);
    if (!aggregate) continue;
    aggregate.totalSkus += 1;

    const variant = row.product_variants;
    const status = getStockStatus(row.on_hand, variant?.products?.is_active ?? true);
    if (status === "out_of_stock") aggregate.outOfStockCount += 1;
    if (status === "low_stock") aggregate.lowStockCount += 1;

    if (variant?.unit_price != null) {
      aggregate.valueByCurrency.set(
        variant.currency,
        (aggregate.valueByCurrency.get(variant.currency) ?? 0) +
          row.on_hand * variant.unit_price
      );
    }
  }
  const locationSummaryRows: LocationSummaryRow[] = locationList.map((location) => {
    const aggregate = locationAggregates.get(location.id)!;
    return {
      id: location.id,
      name: location.name,
      valueByCurrency: [...aggregate.valueByCurrency.entries()].sort(
        (a, b) => b[1] - a[1]
      ),
      totalSkus: aggregate.totalSkus,
      outOfStockCount: aggregate.outOfStockCount,
      lowStockCount: aggregate.lowStockCount,
    };
  });

  // --- 90-day activity + revenue series, and the net 7-day value trend ----
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dayKeys = Array.from({ length: ACTIVITY_WINDOW_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (ACTIVITY_WINDOW_DAYS - 1 - i));
    return d.toISOString().slice(0, 10);
  });

  const activityByDay = new Map<string, Record<MovementBucket, number>>(
    dayKeys.map((key) => [
      key,
      { received: 0, sold: 0, transferred: 0, adjusted: 0 },
    ])
  );
  const revenueByDay = new Map<string, Map<string, number>>(
    dayKeys.map((key) => [key, new Map()])
  );
  const currencySet = new Set<string>();
  const netStockValueChange7d = new Map<string, number>();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  for (const movement of movements) {
    const dateKey = new Date(movement.created_at).toISOString().slice(0, 10);
    const dayActivity = activityByDay.get(dateKey);
    if (dayActivity) {
      dayActivity[movementBucket(movement.movement_type)] += Math.abs(
        movement.quantity
      );
    }

    const variant = movement.product_variants;
    if (movement.movement_type === "SALE" && variant?.unit_price != null) {
      const revenue = Math.abs(movement.quantity) * variant.unit_price;
      currencySet.add(variant.currency);
      const dayRevenue = revenueByDay.get(dateKey);
      if (dayRevenue) {
        dayRevenue.set(
          variant.currency,
          (dayRevenue.get(variant.currency) ?? 0) + revenue
        );
      }
    }

    if (
      variant?.unit_price != null &&
      new Date(movement.created_at) >= sevenDaysAgo
    ) {
      netStockValueChange7d.set(
        variant.currency,
        (netStockValueChange7d.get(variant.currency) ?? 0) +
          movement.quantity * variant.unit_price
      );
    }
  }

  const currencies = [...currencySet].sort();

  const activitySeries: ActivityDay[] = dayKeys.map((date) => ({
    date,
    ...activityByDay.get(date)!,
  }));

  const revenueSeries: RevenueDay[] = dayKeys.map((date) => {
    const dayMap = revenueByDay.get(date)!;
    const amounts: Record<string, number> = {};
    for (const currency of currencies) {
      amounts[currency] = dayMap.get(currency) ?? 0;
    }
    return { date, amounts };
  });

  const expiringSoonRows: ExpiringSoonRow[] = batches.map((batch) => ({
    id: batch.id,
    variantLabel: variantLabel(batch.product_variants),
    batchNumber: batch.batch_number,
    locationName: batch.locations?.name ?? "—",
    expiryDate: batch.expiry_date,
    quantityRemaining: batch.quantity_remaining,
  }));

  // Every movement in the 90-day window, not just the last 15 — the feed
  // paginates itself now, so there's no need to pre-truncate here.
  const activityRows: ActivityRow[] = movements.map((movement) => ({
    id: movement.id,
    variantLabel: variantLabel(movement.product_variants),
    movementType: movement.movement_type,
    locationName: movement.locations?.name ?? "—",
    createdAt: movement.created_at,
    quantity: movement.quantity,
  }));

  // --- Stat card display values --------------------------------------------
  const stockValueNode: ReactNode =
    currencyValueEntries.length > 0 ? (
      <>
        {formatMoney(currencyValueEntries[0][1], currencyValueEntries[0][0])}
        {currencyValueEntries.length > 1 ? (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            +{" "}
            {currencyValueEntries
              .slice(1)
              .map(([currency, value]) => formatMoney(value, currency))
              .join(", ")}
          </span>
        ) : null}
      </>
    ) : (
      "—"
    );

  const primaryValueCurrency = currencyValueEntries[0]?.[0];
  const netChangeForPrimary = primaryValueCurrency
    ? netStockValueChange7d.get(primaryValueCurrency)
    : undefined;
  const stockValueTrend =
    netChangeForPrimary != null && Math.abs(netChangeForPrimary) >= 0.01
      ? `Net ${netChangeForPrimary >= 0 ? "+" : ""}${formatMoney(
          netChangeForPrimary,
          primaryValueCurrency!
        )} from ledger activity (7d)`
      : undefined;

  return (
    <div className="flex w-full flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Dashboard</h1>
        <p className="text-page-subtitle">{user.email}</p>
      </div>

      {/* Stat cards — 2 per row on mobile, 4 across from tablet up */}
      <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4">
        <StatCard
          label="Total SKUs"
          value={String(totalSkus)}
          href="/products"
          icon={Package}
          tone="primary"
        />
        <StatCard
          label="Total stock value"
          value={stockValueNode}
          trend={stockValueTrend}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Low stock"
          value={String(lowStockCount)}
          href="/products?status=low_stock"
          icon={TrendingDown}
          tone="warning"
        />
        <StatCard
          label="Out of stock"
          value={String(outOfStockCount)}
          href="/products?status=out_of_stock"
          icon={AlertTriangle}
          tone="critical"
        />
      </div>

      {/* Trend charts */}
      <StockActivityChart data={activitySeries} />
      <RevenueChart data={revenueSeries} currencies={currencies} />

      {/* Stock by location — one merged table (value bar + counts), not a
          separate chart repeating the same three numbers. */}
      <LocationSummaryTable rows={locationSummaryRows} />

      {/* Low stock items */}
      <LowStockTable rows={lowStockRows} threshold={LOW_STOCK_THRESHOLD} />

      {/* Expiring soon */}
      <ExpiringSoonTable rows={expiringSoonRows} windowDays={EXPIRY_WINDOW_DAYS} />

      {/* Recent activity */}
      <RecentActivityFeed rows={activityRows} />
    </div>
  );
}
