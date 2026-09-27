import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import {
  StockOutLookup,
  type ClientOption,
  type LocationOption,
} from "@/components/stock-out/stock-out-lookup";

export default async function StockOutPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // Only locations THIS user is assigned to (user_locations, Stage 2), and
  // only if still active — an assignment to a since-deactivated location
  // isn't usable. Stage 4 point 2: the dropdown shows only these, never
  // every location in the org. `locations!inner` turns the embed into an
  // actual join so `.eq("locations.is_active", true)` filters at the DB
  // level, not just on the client.
  const [myLocationsRes, clientsRes] = await Promise.all([
    supabase
      .from("user_locations")
      .select("location_id, locations!inner(id, name, is_active)")
      .eq("user_id", user.id)
      .eq("locations.is_active", true),
    supabase.from("clients").select("id, name").eq("is_active", true).order("name"),
  ]);

  if (myLocationsRes.error) throw myLocationsRes.error;
  if (clientsRes.error) throw clientsRes.error;

  const myLocations: LocationOption[] = (myLocationsRes.data ?? []).map((row) => {
    const location = row.locations as unknown as { id: string; name: string };
    return { id: location.id, name: location.name };
  });
  const clients: ClientOption[] = clientsRes.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Stock Out</h1>
        <p className="text-page-subtitle">
          Scan a product and hand it out to a client from one of your
          assigned locations.
        </p>
      </div>

      <StockOutLookup myLocations={myLocations} clients={clients} />
    </div>
  );
}
