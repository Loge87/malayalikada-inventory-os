import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import { LocationForm } from "@/components/locations/location-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LocationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const role = await getCurrentUserRole(supabase);
  const canManage = hasPermission(role, "locations:manage");

  // RLS scopes rows to the caller's organisation.
  const { data: locations, error } = await supabase
    .from("locations")
    .select("id, name, type")
    .order("name");

  if (error) {
    throw error;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Locations</h1>
        <p className="text-page-subtitle">
          {locations && locations.length > 0
            ? `${locations.length} location${locations.length === 1 ? "" : "s"} — warehouse and stores`
            : "No locations yet"}
        </p>
      </div>

      {canManage ? <LocationForm /> : null}

      <Card>
        <CardHeader>
          <CardTitle>All locations</CardTitle>
        </CardHeader>
        <CardContent>
          {locations && locations.length > 0 ? (
            <ul className="divide-y divide-border">
              {locations.map((location) => (
                <li
                  key={location.id}
                  className="flex items-center justify-between py-2"
                >
                  <span>{location.name}</span>
                  <span className="text-muted-foreground capitalize">
                    {location.type}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No locations yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
