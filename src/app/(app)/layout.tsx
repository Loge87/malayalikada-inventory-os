import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import type { Role } from "@/lib/permissions";
import { AppNav } from "@/components/nav/app-nav";
import { RoleProvider } from "@/components/providers/role-provider";

/**
 * Wraps every authenticated page (everything under the (app) route group —
 * dashboard, products, locations, movements, transfers, purchase-orders,
 * batches, stock-counts, scan, integrations) with the persistent nav and the
 * single auth check for all of them. (auth) (login/signup) and /auth sit
 * outside this group, so they never get the nav.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // Non-fatal: the nav should still render even if this lookup has an issue —
  // it just shows no role rather than breaking every authenticated page.
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = (roleRow?.role as Role | undefined) ?? null;

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <AppNav userEmail={user.email ?? ""} role={role} />
      <main className="flex-1 pb-16 md:pb-0">
        <RoleProvider role={role}>{children}</RoleProvider>
      </main>
    </div>
  );
}
