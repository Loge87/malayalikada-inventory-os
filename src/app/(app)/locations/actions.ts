"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import {
  LOCATION_TYPES,
  type LocationFormState,
  type LocationType,
} from "@/app/(app)/locations/constants";

export async function createLocation(
  _prevState: LocationFormState,
  formData: FormData
): Promise<LocationFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  if (!name) {
    return { error: "Name is required." };
  }
  if (!LOCATION_TYPES.includes(type as LocationType)) {
    return { error: "Choose a location type." };
  }

  const supabase = await createClient();

  const organisationId = await getCurrentOrganisationId(supabase);

  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  // The `locations` RLS policy requires the inserted row's `organisation_id` to
  // match the caller's org, so it is set explicitly. Locations are not part of
  // the inventory ledger, so a direct insert is fine.
  const { error } = await supabase
    .from("locations")
    .insert({ name, type, organisation_id: organisationId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/locations");
  return { ok: true };
}
