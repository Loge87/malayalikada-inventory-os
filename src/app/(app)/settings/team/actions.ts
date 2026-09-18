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
