import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  StartCountForm,
  type LocationOption,
} from "@/components/stock-counts/start-count-form";
import {
  CountEntryForm,
  type CountItem,
} from "@/components/stock-counts/count-entry-form";
import type { StockCountStatus } from "@/app/stock-counts/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type VariantRef = {
  name: string;
  sku: string;
  products: { name: string } | null;
} | null;

type CountRow = {
  id: string;
  location_id: string;
  status: StockCountStatus;
  started_at: string;
  completed_at: string | null;
  locations: { name: string } | null;
  stock_count_items: {
    id: string;
    expected_quantity: number;
    counted_quantity: number | null;
    product_variants: VariantRef;
  }[];
};

function variantLabel(variant: VariantRef): string {
  if (!variant) return "Unknown variant";
  return variant.products?.name
    ? `${variant.products.name} — ${variant.name}`
    : variant.name;
}

export default async function StockCountsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [locationsRes, countsRes] = await Promise.all([
    supabase.from("locations").select("id, name").order("name"),
    supabase
      .from("stock_counts")
      .select(
        `id, location_id, status, started_at, completed_at,
         locations(name),
         stock_count_items(
           id, expected_quantity, counted_quantity,
           product_variants(name, sku, products(name))
         )`
      )
      .order("started_at", { ascending: false })
      .returns<CountRow[]>(),
  ]);

  const firstError = locationsRes.error || countsRes.error;
  if (firstError) {
    throw firstError;
  }

  const locations = locationsRes.data ?? [];
  const counts = countsRes.data ?? [];

  const inProgress = counts.filter((c) => c.status === "in_progress");
  const completed = counts.filter((c) => c.status === "completed");

  const busyLocationIds = new Set(inProgress.map((c) => c.location_id));
  const availableLocations: LocationOption[] = locations.filter(
    (l) => !busyLocationIds.has(l.id)
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 md:p-10">
      <div>
        <h1 className="font-heading text-xl font-medium">Stock counts</h1>
        <p className="text-muted-foreground text-sm">
          Corrections are recorded as ADJUSTMENT movements in the ledger, one per
          discrepancy.
        </p>
      </div>

      <StartCountForm locations={availableLocations} />

      {inProgress.map((count) => {
        const items: CountItem[] = [...count.stock_count_items]
          .map((item) => ({
            id: item.id,
            label: variantLabel(item.product_variants),
            expected: item.expected_quantity,
            counted: item.counted_quantity,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));

        return (
          <CountEntryForm
            key={count.id}
            stockCountId={count.id}
            locationName={count.locations?.name ?? "Unknown location"}
            startedAt={formatDateTime(count.started_at)}
            items={items}
          />
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>Completed counts</CardTitle>
          <CardDescription>
            {completed.length > 0 ? `${completed.length} total` : "None yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {completed.length > 0 ? (
            <ul className="divide-y divide-border">
              {completed.map((count) => {
                const adjusted = count.stock_count_items.filter(
                  (item) =>
                    item.counted_quantity != null &&
                    item.counted_quantity !== item.expected_quantity
                ).length;
                return (
                  <li
                    key={count.id}
                    className="flex items-center justify-between gap-4 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">
                        {count.locations?.name ?? "Unknown location"}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {count.completed_at
                          ? formatDate(count.completed_at)
                          : ""}{" "}
                        · {count.stock_count_items.length} items
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {adjusted} adjusted
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground">No completed counts yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
