"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import type {
  ClientFormState,
  DeleteClientState,
  UpdateClientState,
} from "@/app/(app)/clients/constants";

/** Named addClient (not createClient) — createClient is already the
 *  Supabase client factory (@/lib/supabase/server) imported by every server
 *  action file, this one included; reusing that name here would shadow it. */
export async function addClient(
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const contactPerson = String(formData.get("contactPerson") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (!name) {
    return { error: "Name is required." };
  }
  if (!phone) {
    return { error: "Phone is required." };
  }
  if (!address) {
    return { error: "Address is required." };
  }

  const supabase = await createClient();

  // UI-level permission model (lib/permissions.ts), checked here too since
  // the `clients` RLS policy doesn't itself distinguish staff from admin —
  // it only scopes by organisation.
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "clients:manage")) {
    return { error: "You don't have permission to add clients." };
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const { error } = await supabase.from("clients").insert({
    organisation_id: organisationId,
    name,
    contact_person: contactPerson || null,
    phone,
    email: email || null,
    address,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clients");
  return { ok: true };
}

/**
 * Update a client's own fields — name, contact person, phone, email,
 * address, and active status. Active is normally flipped by deleteClient
 * below (deactivated when it has stock-out history), but exposed here
 * directly too so a deactivated client can be manually reactivated.
 */
export async function updateClient(
  _prevState: UpdateClientState,
  formData: FormData
): Promise<UpdateClientState> {
  const clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const contactPerson = String(formData.get("contactPerson") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const isActive = formData.get("isActive") === "on";

  if (!clientId) {
    return { error: "Missing client." };
  }
  if (!name) {
    return { error: "Name is required." };
  }
  if (!phone) {
    return { error: "Phone is required." };
  }
  if (!address) {
    return { error: "Address is required." };
  }

  const supabase = await createClient();

  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "clients:manage")) {
    return { error: "You don't have permission to edit clients." };
  }

  const { error } = await supabase
    .from("clients")
    .update({
      name,
      contact_person: contactPerson || null,
      phone,
      email: email || null,
      address,
      is_active: isActive,
    })
    .eq("id", clientId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clients");
  return { ok: true };
}

/**
 * Deletes a client, or deactivates it if it can't be safely removed.
 * delete_client() checks stock_outs for any row referencing the client: if
 * any exist, it sets clients.is_active = false instead (a stock-out is a
 * permanent business record); otherwise it removes the client. Same shape
 * and rule as deleteProduct/deleteLocation.
 */
export async function deleteClient(
  _prevState: DeleteClientState,
  formData: FormData
): Promise<DeleteClientState> {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) {
    return { error: "Missing client." };
  }

  const supabase = await createClient();

  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "clients:manage")) {
    return { error: "You don't have permission to delete clients." };
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const { data, error } = await supabase.rpc("delete_client", {
    p_organisation_id: organisationId,
    p_client_id: clientId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clients");
  return { ok: true, result: data as "deleted" | "deactivated" };
}
