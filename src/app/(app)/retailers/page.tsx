import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import {
  RetailersManager,
  type RetailerRow,
} from "@/components/retailers/retailers-manager";

export default async function RetailersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "wholesale:manage")) redirect("/dashboard");

  const { data, error } = await supabase
    .from("retailers")
    .select(
      "id, business_name, contact_name, email, phone, address, notes, status, user_id, created_at"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const retailers: RetailerRow[] = (data ?? []).map((r) => ({
    id: r.id,
    businessName: r.business_name,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone,
    address: r.address,
    notes: r.notes,
    status: r.status,
    hasLogin: r.user_id !== null,
    createdAt: r.created_at,
  }));

  return (
    <div className="flex w-full flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Retailers</h1>
        <p className="text-page-subtitle">
          Businesses that order from your wholesale portal. New sign-ups wait
          here for your approval.
        </p>
      </div>
      <RetailersManager retailers={retailers} />
    </div>
  );
}
