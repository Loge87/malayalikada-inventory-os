import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import { ClientEditPageContent } from "@/components/clients/client-edit-page-content";

export default async function ClientEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "clients:manage")) {
    redirect("/dashboard");
  }

  const { id } = await params;

  // RLS scopes this to the caller's organisation.
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, name, contact_person, phone, email, address, is_active")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!client) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <ClientEditPageContent
        client={{
          id: client.id,
          name: client.name,
          contactPerson: client.contact_person,
          phone: client.phone,
          email: client.email,
          address: client.address,
          isActive: client.is_active,
        }}
      />
    </div>
  );
}
