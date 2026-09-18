import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getCurrentUserRole } from "@/lib/roles";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { hasPermission } from "@/lib/permissions";
import {
  AuditLogView,
  PAGE_SIZE,
  type AuditLogRow,
  type IntegrationEventRow,
} from "@/components/audit-log/audit-log-view";

export default async function AuditLogPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // Admin/owner only — same pattern as /integrations and /settings/team.
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "audit:view")) {
    redirect("/dashboard");
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    throw new Error("Could not determine your organisation.");
  }

  const [locationsRes, actorsRes, logRes, eventsRes] = await Promise.all([
    supabase.from("locations").select("id, name").order("name"),
    supabase.rpc("list_audit_log_users", { p_organisation_id: organisationId }),
    supabase.rpc("list_audit_log", {
      p_organisation_id: organisationId,
      p_limit: PAGE_SIZE,
      p_offset: 0,
    }),
    supabase
      .from("integration_events")
      .select(
        "id, source_system, event_type, external_reference, processing_status, retry_count, last_error, received_at, processed_at"
      )
      .order("received_at", { ascending: false })
      .limit(50),
  ]);

  const firstError =
    locationsRes.error || actorsRes.error || logRes.error || eventsRes.error;
  if (firstError) {
    throw firstError;
  }

  const rows = (logRes.data ?? []) as AuditLogRow[];
  const totalCount = rows[0]?.total_count ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Audit Log</h1>
        <p className="text-page-subtitle">
          Every stock change — who, what, when, where, and why — plus POS/
          webhook activity. Read-only.
        </p>
      </div>

      <AuditLogView
        organisationId={organisationId}
        locations={locationsRes.data ?? []}
        actors={actorsRes.data ?? []}
        initialRows={rows}
        initialTotalCount={totalCount}
        integrationEvents={(eventsRes.data ?? []) as IntegrationEventRow[]}
      />
    </div>
  );
}
