import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // The `locations` RLS policy already scopes rows to the caller's
  // organisation, so a plain select returns only this user's locations.
  const { data: locations, error } = await supabase
    .from("locations")
    .select("id, name")
    .order("name");

  if (error) {
    throw error;
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-6 md:p-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          {locations && locations.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {locations.map((location) => (
                <li key={location.id}>{location.name}</li>
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
