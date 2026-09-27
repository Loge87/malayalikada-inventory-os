import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { StockOutLookup } from "@/components/stock-out/stock-out-lookup";
import { StockOutTabs } from "@/components/stock-out/stock-out-tabs";
import {
  StockOutHistory,
  type FilterOption,
  type StockOutFilters,
  type StockOutRow,
} from "@/components/stock-out/stock-out-history";
import type { ClientOption, LocationOption } from "@/components/stock-out/stock-out-lookup";

type StockOutHistoryQueryRow = {
  id: string;
  quantity: number;
  created_at: string;
  clients: { name: string } | null;
  locations: { name: string } | null;
  product_variants: {
    name: string;
    sku: string;
    products: { name: string } | null;
  } | null;
};

export default async function StockOutPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    client?: string;
    product?: string;
    location?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const params = await searchParams;
  // Only the INITIAL tab for a fresh page load (so a shared/reloaded
  // ?tab=history link still lands on the right one) — StockOutTabs owns
  // which tab is showing as pure client state from here on, so switching
  // between them never has to wait on a server round trip.
  const activeTab = params.tab === "history" ? "history" : "record";

  // Only locations THIS user is assigned to (user_locations, Stage 2), and
  // only if still active — an assignment to a since-deactivated location
  // isn't usable. Stage 4 point 2: the dropdown shows only these, never
  // every location in the org. `locations!inner` turns the embed into an
  // actual join so `.eq("locations.is_active", true)` filters at the DB
  // level, not just on the client.
  const [
    myLocationsRes,
    activeClientsRes,
    allClientsRes,
    allLocationsRes,
    allVariantsRes,
  ] = await Promise.all([
    supabase
      .from("user_locations")
      .select("location_id, locations!inner(id, name, is_active)")
      .eq("user_id", user.id)
      .eq("locations.is_active", true),
    supabase.from("clients").select("id, name").eq("is_active", true).order("name"),
    // History's own filters deliberately include inactive clients/locations
    // — same "historical views still show soft-deleted data" principle as
    // audit-log/movements: a past stock-out to a client who's since been
    // deactivated must still be findable.
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("locations").select("id, name").order("name"),
    supabase
      .from("product_variants")
      .select("id, name, sku, products(name)")
      .order("name"),
  ]);

  if (myLocationsRes.error) throw myLocationsRes.error;
  if (activeClientsRes.error) throw activeClientsRes.error;
  if (allClientsRes.error) throw allClientsRes.error;
  if (allLocationsRes.error) throw allLocationsRes.error;
  if (allVariantsRes.error) throw allVariantsRes.error;

  const myLocations: LocationOption[] = (myLocationsRes.data ?? []).map((row) => {
    const location = row.locations as unknown as { id: string; name: string };
    return { id: location.id, name: location.name };
  });
  const clients: ClientOption[] = activeClientsRes.data ?? [];

  const clientOptions: FilterOption[] = (allClientsRes.data ?? []).map((c) => ({
    id: c.id,
    label: c.name,
  }));
  const locationOptions: FilterOption[] = (allLocationsRes.data ?? []).map((l) => ({
    id: l.id,
    label: l.name,
  }));
  const productOptions: FilterOption[] = (allVariantsRes.data ?? []).map((v) => {
    const product = v.products as unknown as { name: string } | null;
    return {
      id: v.id,
      label: product?.name ? `${product.name} — ${v.name} (${v.sku})` : `${v.name} (${v.sku})`,
    };
  });

  const filters: StockOutFilters = {
    clientId: params.client ?? null,
    productVariantId: params.product ?? null,
    locationId: params.location ?? null,
    from: params.from ?? null,
    to: params.to ?? null,
  };

  let historyQuery = supabase
    .from("stock_outs")
    .select(
      "id, quantity, created_at, clients(name), locations(name), product_variants(name, sku, products(name))"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters.clientId) historyQuery = historyQuery.eq("client_id", filters.clientId);
  if (filters.productVariantId) {
    historyQuery = historyQuery.eq("product_variant_id", filters.productVariantId);
  }
  if (filters.locationId) historyQuery = historyQuery.eq("location_id", filters.locationId);
  if (filters.from) historyQuery = historyQuery.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) historyQuery = historyQuery.lte("created_at", `${filters.to}T23:59:59.999Z`);

  // Fetched unconditionally, regardless of which tab is initially active —
  // the whole point of making tab-switching client-side-only (see
  // StockOutTabs) is that History's data has to already be on hand the
  // instant someone clicks the tab, with no further round trip. Cheap
  // enough now that stock_outs has real indexes (0027_*.sql) to back this
  // exact query shape (product_variant_id/created_at/organisation_id, on
  // top of the existing location_id/client_id ones).
  const historyRes = await historyQuery.returns<StockOutHistoryQueryRow[]>();
  if (historyRes.error) throw historyRes.error;

  const stockOuts: StockOutRow[] = (historyRes.data ?? []).map((row) => {
    const variant = row.product_variants;
    const product = variant?.products as unknown as { name: string } | null;
    const productLabel = variant
      ? product?.name
        ? `${product.name} — ${variant.name} (${variant.sku})`
        : `${variant.name} (${variant.sku})`
      : "Unknown product";
    return {
      id: row.id,
      createdAt: row.created_at,
      quantity: row.quantity,
      clientName: row.clients?.name ?? "Unknown client",
      locationName: row.locations?.name ?? "Unknown location",
      productLabel,
    };
  });

  return (
    <div className="flex w-full flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Stock Out</h1>
        <p className="text-page-subtitle">
          Scan a product and hand it out to a client from one of your
          assigned locations.
        </p>
      </div>

      <StockOutTabs
        activeTab={activeTab}
        recordContent={<StockOutLookup myLocations={myLocations} clients={clients} />}
        historyContent={
          <StockOutHistory
            stockOuts={stockOuts}
            clientOptions={clientOptions}
            productOptions={productOptions}
            locationOptions={locationOptions}
            filters={filters}
          />
        }
      />
    </div>
  );
}
