import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import { AddClientDialog } from "@/components/clients/add-client-dialog";
import { ClientsPageContent } from "@/components/clients/clients-page-content";
import type { EditableClient } from "@/components/clients/clients-list";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const supabase = await createClient();

  // Admin/owner only — same pattern as /audit-log and /settings/team.
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "clients:manage")) {
    redirect("/dashboard");
  }

  // RLS scopes rows to the caller's organisation. Active and inactive
  // clients both show here (with a status pill) — this is the one page
  // that manages clients, including reactivating a deactivated one, so it
  // deliberately doesn't filter is_active out. Same convention as
  // /locations.
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, contact_person, phone, email, address, is_active")
    .order("name");
  if (error) {
    throw error;
  }

  const clients: EditableClient[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    contactPerson: c.contact_person,
    phone: c.phone,
    email: c.email,
    address: c.address,
    isActive: c.is_active,
  }));
  const activeCount = clients.filter((c) => c.isActive).length;

  return (
    <div className="flex w-full flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title">Clients</h1>
          <p className="text-page-subtitle">
            {activeCount > 0
              ? `${activeCount} client${activeCount === 1 ? "" : "s"}`
              : "No clients yet"}
          </p>
        </div>
        <AddClientDialog />
      </div>

      <ClientsPageContent clients={clients} emptyMessage="No clients yet" />
    </div>
  );
}
