"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission, type Role } from "@/lib/permissions";

const VALID_ROLES: Role[] = ["staff", "admin", "owner"];

/** Every action here first re-checks hasPermission server-side — the page
 *  is already gated (redirects non-owners), but these are also reachable
 *  directly, and RLS's INSERT/UPDATE/DELETE policies on user_roles (added
 *  in 0013_team_management.sql) check is_org_owner independently too, so
 *  this is belt-and-suspenders, not the only check. */
async function requireOwner(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ error: string } | { organisationId: string }> {
  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "roles:manage")) {
    return { error: "Only an owner can manage team members." };
  }
  return { organisationId };
}

type LookupInviteeResult =
  | { status: "ok"; user_id: string }
  | { status: "already_member"; user_id: string }
  | { status: "in_other_org" }
  | { status: "not_found" };

export type InviteMemberState =
  | { error: string }
  | { needsSignup: true; signupUrl: string }
  | { ok: true }
  | undefined;

/**
 * There's no email-invite-with-signup-link system yet — this only works if
 * the person already has an auth.users account (they signed up themselves)
 * but isn't in this organisation yet. lookup_invitee (0013_*.sql) resolves
 * the email and reports which case applies; this just acts on it.
 */
/** Parses the invite/assign forms' `locationIds` field — a JSON-encoded
 *  array of location ids, same convention as products-table.tsx's
 *  productIds/variantIds hidden fields. */
function parseLocationIds(formData: FormData): { error: string } | { value: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("locationIds") ?? "[]"));
  } catch {
    return { error: "Malformed location selection." };
  }
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
    return { error: "Malformed location selection." };
  }
  return { value: parsed };
}

export async function inviteMember(
  _prevState: InviteMemberState,
  formData: FormData
): Promise<InviteMemberState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");

  if (!email) {
    return { error: "Enter an email address." };
  }
  if (!VALID_ROLES.includes(role as Role)) {
    return { error: "Choose a role." };
  }
  const locationIdsResult = parseLocationIds(formData);
  if ("error" in locationIdsResult) {
    return locationIdsResult;
  }
  const { value: locationIds } = locationIdsResult;
  if (role === "staff" && locationIds.length === 0) {
    return { error: "Assign at least one location to a staff member." };
  }

  const supabase = await createClient();
  const check = await requireOwner(supabase);
  if ("error" in check) {
    return check;
  }
  const { organisationId } = check;

  const { data, error } = await supabase.rpc("lookup_invitee", {
    p_organisation_id: organisationId,
    p_email: email,
  });
  if (error) {
    return { error: error.message };
  }
  const result = data as LookupInviteeResult;

  if (result.status === "not_found") {
    const origin = (await headers()).get("origin");
    return { needsSignup: true, signupUrl: `${origin}/signup` };
  }
  if (result.status === "already_member") {
    return { error: "This person is already a member of your organisation." };
  }
  if (result.status === "in_other_org") {
    return { error: "This person already belongs to a different organisation." };
  }

  const { error: insertError } = await supabase.from("user_roles").insert({
    organisation_id: organisationId,
    user_id: result.user_id,
    role,
  });
  if (insertError) {
    return { error: insertError.message };
  }

  if (locationIds.length > 0) {
    const { error: locationsError } = await supabase.from("user_locations").insert(
      locationIds.map((locationId) => ({
        organisation_id: organisationId,
        user_id: result.user_id,
        location_id: locationId,
      }))
    );
    if (locationsError) {
      // The member is already added at this point (user_roles succeeded) —
      // surface the error so the owner knows to assign locations manually
      // from the member list below, rather than pretending nothing happened.
      return { error: `Member added, but location assignment failed: ${locationsError.message}` };
    }
  }

  revalidatePath("/settings/team");
  return { ok: true };
}

export type UpdateMemberRoleState = { error: string } | { ok: true } | undefined;

export async function updateMemberRole(
  _prevState: UpdateMemberRoleState,
  formData: FormData
): Promise<UpdateMemberRoleState> {
  const targetUserId = String(formData.get("userId") ?? "");
  const newRole = String(formData.get("role") ?? "");
  if (!targetUserId) {
    return { error: "Missing member." };
  }
  if (!VALID_ROLES.includes(newRole as Role)) {
    return { error: "Choose a role." };
  }

  const supabase = await createClient();
  const check = await requireOwner(supabase);
  if ("error" in check) {
    return check;
  }
  const { organisationId } = check;

  // Friendly pre-check for the last-owner rule — the DB trigger
  // (prevent_removing_last_owner) is the real, unbypassable enforcement;
  // this just avoids surfacing a raw Postgres exception message.
  const { data: members, error: membersError } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .eq("organisation_id", organisationId);
  if (membersError) {
    return { error: membersError.message };
  }
  const target = members?.find((m) => m.user_id === targetUserId);
  if (!target) {
    return { error: "Member not found." };
  }
  if (target.role === "owner" && newRole !== "owner") {
    const ownerCount = members.filter((m) => m.role === "owner").length;
    if (ownerCount <= 1) {
      return { error: "An organisation must have at least one owner." };
    }
  }

  // Staff must always have at least one assigned location (same rule
  // assignMemberLocations enforces from the other direction) — a role
  // change to staff has to check the member's EXISTING user_locations
  // rows, since this form doesn't touch location assignment itself.
  if (newRole === "staff" && target.role !== "staff") {
    const { count, error: countError } = await supabase
      .from("user_locations")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .eq("user_id", targetUserId);
    if (countError) {
      return { error: countError.message };
    }
    if (!count) {
      return {
        error: "Assign this member to at least one location before making them staff.",
      };
    }
  }

  const { error } = await supabase
    .from("user_roles")
    .update({ role: newRole })
    .eq("organisation_id", organisationId)
    .eq("user_id", targetUserId);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings/team");
  return { ok: true };
}

export type RemoveMemberState = { error: string } | { ok: true } | undefined;

export async function removeMember(
  _prevState: RemoveMemberState,
  formData: FormData
): Promise<RemoveMemberState> {
  const targetUserId = String(formData.get("userId") ?? "");
  if (!targetUserId) {
    return { error: "Missing member." };
  }

  const supabase = await createClient();
  const check = await requireOwner(supabase);
  if ("error" in check) {
    return check;
  }
  const { organisationId } = check;

  const { data: members, error: membersError } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .eq("organisation_id", organisationId);
  if (membersError) {
    return { error: membersError.message };
  }
  const target = members?.find((m) => m.user_id === targetUserId);
  if (!target) {
    return { error: "Member not found." };
  }
  if (target.role === "owner") {
    const ownerCount = members.filter((m) => m.role === "owner").length;
    if (ownerCount <= 1) {
      return {
        error:
          "An organisation must have at least one owner — make someone else an owner before removing this one.",
      };
    }
  }

  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("organisation_id", organisationId)
    .eq("user_id", targetUserId);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings/team");
  return { ok: true };
}

export type AssignMemberLocationsState = { error: string } | { ok: true } | undefined;

/**
 * Replaces a member's full set of assigned locations (Stock Out feature,
 * Stage 2) — gated by locations:manage, not roles:manage, so an admin can
 * do this even though they can't invite/change roles/remove members. Same
 * "any org member" RLS as every other locations:manage-gated write
 * (locations itself, createLocation/updateLocation) — this is the app-side
 * half of that convention.
 */
export async function assignMemberLocations(
  _prevState: AssignMemberLocationsState,
  formData: FormData
): Promise<AssignMemberLocationsState> {
  const targetUserId = String(formData.get("userId") ?? "");
  if (!targetUserId) {
    return { error: "Missing member." };
  }
  const locationIdsResult = parseLocationIds(formData);
  if ("error" in locationIdsResult) {
    return locationIdsResult;
  }
  const { value: locationIds } = locationIdsResult;

  const supabase = await createClient();
  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "locations:manage")) {
    return { error: "You don't have permission to assign locations." };
  }

  const { data: target, error: targetError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("organisation_id", organisationId)
    .eq("user_id", targetUserId)
    .single();
  if (targetError || !target) {
    return { error: "Member not found." };
  }
  if (target.role === "staff" && locationIds.length === 0) {
    return { error: "Staff members need at least one assigned location." };
  }

  // Replace the full set: delete every existing assignment for this member,
  // then insert the new one — simpler and safer than diffing, and this
  // action always receives the complete desired set (see
  // LocationAssignmentField), never a partial add/remove.
  const { error: deleteError } = await supabase
    .from("user_locations")
    .delete()
    .eq("organisation_id", organisationId)
    .eq("user_id", targetUserId);
  if (deleteError) {
    return { error: deleteError.message };
  }

  if (locationIds.length > 0) {
    const { error: insertError } = await supabase.from("user_locations").insert(
      locationIds.map((locationId) => ({
        organisation_id: organisationId,
        user_id: targetUserId,
        location_id: locationId,
      }))
    );
    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath("/settings/team");
  return { ok: true };
}
