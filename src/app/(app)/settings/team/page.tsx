import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getCurrentUserRole } from "@/lib/roles";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { hasPermission } from "@/lib/permissions";
import { TeamManagement, type Member } from "@/components/settings/team-management";

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

  // Owner-only — same pattern as the /integrations restriction.
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "roles:manage")) {
    redirect("/dashboard");
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    throw new Error("Could not determine your organisation.");
  }

  // list_org_members joins auth.users for email — not reachable from a
  // plain RLS-scoped query — and is itself gated to owners (0013_*.sql).
  const { data, error } = await supabase.rpc("list_org_members", {
    p_organisation_id: organisationId,
  });
  if (error) {
    throw error;
  }

  const rows = (data ?? []) as MemberRow[];
  const members: Member[] = rows.map((row) => ({
    userId: row.user_id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Team</h1>
        <p className="text-page-subtitle">
          Manage who has access to this organisation and their role.
        </p>
      </div>

      <TeamManagement members={members} currentUserId={user.id} />
    </div>
  );
}
