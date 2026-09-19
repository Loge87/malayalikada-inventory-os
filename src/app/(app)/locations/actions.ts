"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import {
  LOCATION_TYPES,
  type DeleteLocationState,
  type LocationFormState,
  type LocationType,
  type UpdateLocationState,
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

  // UI-level permission model (lib/permissions.ts), checked here too since
  // the `locations` RLS policy doesn't itself distinguish staff from admin
  // — it only scopes by organisation.
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "locations:manage")) {
    return { error: "You don't have permission to add locations." };
  }

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

/**
 * Update a location's own fields — name, type, and active status. Active is
 * normally flipped by deleteLocation below (deactivated when it has history),
 * but exposed here directly too so a deactivated location can be manually
 * reactivated from its edit panel.
 */
export async function updateLocation(
  _prevState: UpdateLocationState,
  formData: FormData
): Promise<UpdateLocationState> {
  const locationId = String(formData.get("locationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const isActive = formData.get("isActive") === "on";

  if (!locationId) {
    return { error: "Missing location." };
  }
  if (!name) {
    return { error: "Name is required." };
  }
  if (!LOCATION_TYPES.includes(type as LocationType)) {
    return { error: "Choose a location type." };
  }

  const supabase = await createClient();

  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "locations:manage")) {
    return { error: "You don't have permission to edit locations." };
  }

  const { error } = await supabase
    .from("locations")
    .update({ name, type, is_active: isActive })
    .eq("id", locationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/locations");
  return { ok: true };
}

/**
 * Deletes a location, or deactivates it if it can't be safely removed.
 * delete_location() checks inventory_movements, inventory_levels,
 * inventory_batches, stock_counts, and purchase_orders (destination) for any
 * row referencing the location: if any exist, it sets locations.is_active =
 * false instead (several of those are permanent ledger/audit history — see
 * the inventory rule in CLAUDE.md); otherwise it removes the location. Same
 * shape and rule as deleteProduct in products/actions.ts.
 */
export async function deleteLocation(
  _prevState: DeleteLocationState,
  formData: FormData
): Promise<DeleteLocationState> {
  const locationId = String(formData.get("locationId") ?? "");
  if (!locationId) {
    return { error: "Missing location." };
  }

  const supabase = await createClient();

  // UI-level permission model (lib/permissions.ts), checked here too since
  // the `locations` RLS policy doesn't itself distinguish staff from admin —
  // it only scopes by organisation.
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "locations:manage")) {
    return { error: "You don't have permission to delete locations." };
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const { data, error } = await supabase.rpc("delete_location", {
    p_organisation_id: organisationId,
    p_location_id: locationId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/locations");
  return { ok: true, result: data as "deleted" | "deactivated" };
}
