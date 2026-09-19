import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { LocationEditPageContent } from "@/components/locations/location-edit-page-content";

export default async function LocationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { id } = await params;

  // RLS scopes this to the caller's organisation.
  const { data: location, error } = await supabase
    .from("locations")
    .select("id, name, type, is_active")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!location) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <LocationEditPageContent
        location={{
          id: location.id,
          name: location.name,
          type: location.type,
          isActive: location.is_active,
        }}
      />
    </div>
  );
}
