import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import { AddLocationDialog } from "@/components/locations/add-location-dialog";
import { LocationsPageContent } from "@/components/locations/locations-page-content";
import type { EditableLocation } from "@/components/locations/locations-list";

export default async function LocationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const supabase = await createClient();
  const role = await getCurrentUserRole(supabase);
  const canManage = hasPermission(role, "locations:manage");

  // RLS scopes rows to the caller's organisation. Active and inactive
  // locations both show here (with a status pill) — unlike /products, this
  // is the one page that manages locations, including reactivating a
  // deactivated one, so it deliberately doesn't filter is_active out.
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, type, is_active")
    .order("name");
  if (error) {
    throw error;
  }

  const locations: EditableLocation[] = (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    type: l.type,
    isActive: l.is_active,
  }));
  const activeCount = locations.filter((l) => l.isActive).length;

  return (
    <div className="flex w-full flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title">Locations</h1>
          <p className="text-page-subtitle">
            {activeCount > 0
              ? `${activeCount} location${activeCount === 1 ? "" : "s"} — warehouse and stores`
              : "No locations yet"}
          </p>
        </div>
        {canManage ? <AddLocationDialog /> : null}
      </div>

      <LocationsPageContent
        locations={locations}
        emptyMessage="No locations yet"
      />
    </div>
  );
}
