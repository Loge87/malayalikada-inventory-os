import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  LocationPicker,
  type LocationOption,
} from "@/components/batches/location-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type BatchRow = {
  id: string;
  batch_number: string;
  expiry_date: string | null;
  quantity_received: number;
  quantity_remaining: number;
  received_at: string;
  product_variants:
    | { name: string; sku: string; products: { name: string } | null }
    | null;
};

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: locationRows, error: locationsError } = await supabase
    .from("locations")
    .select("id, name")
    .order("name");

  if (locationsError) {
    throw locationsError;
  }

  const locations: LocationOption[] = locationRows ?? [];
  const requested = (await searchParams).location;
  const selectedLocationId =
    locations.find((l) => l.id === requested)?.id ?? locations[0]?.id ?? null;

  let batches: BatchRow[] = [];
  if (selectedLocationId) {
    const { data, error } = await supabase
      .from("inventory_batches")
      .select(
        "id, batch_number, expiry_date, quantity_received, quantity_remaining, received_at, product_variants(name, sku, products(name))"
      )
      .eq("location_id", selectedLocationId)
      // FEFO: soonest expiry first; undated batches last; oldest receipt breaks ties.
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .order("received_at", { ascending: true })
      .returns<BatchRow[]>();

    if (error) {
      throw error;
    }
    batches = data ?? [];
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 md:p-10">
      <Card>
        <CardHeader>
          <CardTitle>Batches — FEFO</CardTitle>
          <CardDescription>
            Stock lots at a location, soonest-expiring first.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {locations.length > 0 ? (
            <LocationPicker
              locations={locations}
              selectedLocationId={selectedLocationId}
            />
          ) : (
            <p className="text-muted-foreground">No locations yet</p>
          )}

          {selectedLocationId && batches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Variant</th>
                    <th className="py-2 pr-4 font-medium">Batch</th>
                    <th className="py-2 pr-4 font-medium">Expiry</th>
                    <th className="py-2 pr-4 font-medium text-right">
                      Remaining
                    </th>
                    <th className="py-2 font-medium text-right">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => {
                    const days =
                      batch.expiry_date != null
                        ? daysUntil(batch.expiry_date)
                        : null;
                    return (
                      <tr
                        key={batch.id}
                        className="border-t border-border align-top"
                      >
                        <td className="py-2 pr-4">
                          <span className="block">
                            {batch.product_variants?.products?.name
                              ? `${batch.product_variants.products.name} — `
                              : ""}
                            {batch.product_variants?.name ?? "Unknown variant"}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {batch.product_variants?.sku ?? ""}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{batch.batch_number}</td>
                        <td className="py-2 pr-4">
                          {batch.expiry_date && days !== null ? (
                            <>
                              {formatDate(batch.expiry_date)}
                              <span
                                className={
                                  days <= 30
                                    ? "block text-xs text-destructive"
                                    : "block text-xs text-muted-foreground"
                                }
                              >
                                {days < 0
                                  ? `expired ${-days}d ago`
                                  : `in ${days}d`}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              no expiry
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {batch.quantity_remaining}
                          <span className="text-muted-foreground">
                            {" "}
                            / {batch.quantity_received}
                          </span>
                        </td>
                        <td className="py-2 text-right text-muted-foreground text-xs">
                          {formatDateTime(batch.received_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : selectedLocationId ? (
            <p className="text-muted-foreground">
              No batches recorded for this location
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
