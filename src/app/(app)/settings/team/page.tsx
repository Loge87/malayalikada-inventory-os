import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getCurrentUserRole } from "@/lib/roles";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { hasPermission } from "@/lib/permissions";
import { TeamManagement, type Member } from "@/components/settings/team-management";
import type { LocationOption } from "@/components/products/variant-extra-fields";

type MemberRow = {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
};

export default async function TeamSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // Owners can invite/change roles/remove members (unchanged, still
  // is_org_owner-gated at the RLS level too). Admins can't do any of that,
  // but they CAN assign locations to staff (locations:manage) — so the page
  // itself now admits either, and the two capabilities are passed down
  // separately so TeamManagement can show each member only what their role
  // allows.
  const role = await getCurrentUserRole(supabase);
  const canManageRoles = hasPermission(role, "roles:manage");
  const canManageLocations = hasPermission(role, "locations:manage");
  if (!canManageRoles && !canManageLocations) {
    redirect("/dashboard");
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    throw new Error("Could not determine your organisation.");
  }

  // list_org_members joins auth.users for email — not reachable from a
  // plain RLS-scoped query — and is gated to owners/admins at the DB level
  // (0013_team_management.sql, broadened to admins in 0022_*.sql).
  const [membersRes, locationsRes, userLocationsRes] = await Promise.all([
    supabase.rpc("list_org_members", { p_organisation_id: organisationId }),
    supabase.from("locations").select("id, name").eq("is_active", true).order("name"),
    supabase.from("user_locations").select("user_id, location_id"),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (locationsRes.error) throw locationsRes.error;
  if (userLocationsRes.error) throw userLocationsRes.error;

  const locationIdsByUser = new Map<string, string[]>();
  for (const row of userLocationsRes.data ?? []) {
    const existing = locationIdsByUser.get(row.user_id) ?? [];
    existing.push(row.location_id);
    locationIdsByUser.set(row.user_id, existing);
  }

  const rows = (membersRes.data ?? []) as MemberRow[];
  const members: Member[] = rows.map((row) => ({
    userId: row.user_id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    locationIds: locationIdsByUser.get(row.user_id) ?? [],
  }));
  const locations: LocationOption[] = locationsRes.data ?? [];

  return (
    <div className="flex w-full flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Team</h1>
        <p className="text-page-subtitle">
          Manage who has access to this organisation, their role, and which
          locations they can work from.
        </p>
      </div>

      <TeamManagement
        members={members}
        locations={locations}
        currentUserId={user.id}
        canManageRoles={canManageRoles}
        canManageLocations={canManageLocations}
      />
    </div>
  );
}
