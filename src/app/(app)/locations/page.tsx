import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { LocationForm } from "@/components/locations/location-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LocationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // RLS scopes rows to the caller's organisation.
  const { data: locations, error } = await supabase
    .from("locations")
    .select("id, name, type")
    .order("name");

  if (error) {
    throw error;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 md:p-10">
      <LocationForm />

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>
            {locations && locations.length > 0
              ? `${locations.length} location${
                  locations.length === 1 ? "" : "s"
                }`
              : "None yet"}
          </CardDescription>
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
