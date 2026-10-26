import { redirect } from "next/navigation";

import { PasswordForm, ProfileForm } from "@/components/settings-forms";
import { getCurrentRetailer, getCurrentUser, getOrganisationId } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");
  const retailer = await getCurrentRetailer();

  let contactName = "";
  let phone = "";
  if (retailer) {
    const { data } = await createAdminClient()
      .from("retailers")
      .select("contact_name, phone")
      .eq("organisation_id", getOrganisationId())
      .eq("id", retailer.id)
      .maybeSingle();
    contactName = data?.contact_name ?? "";
    phone = data?.phone ?? "";
  }

  return (
    <>
      <section className="border-b border-line bg-soft">
        <div className="container-page anim-up py-10">
          <p className="eyebrow">Account</p>
          <h1 className="section-title mt-3">Settings</h1>
        </div>
      </section>
      <div className="container-page grid gap-8 py-10 lg:grid-cols-2 lg:items-start">
        {retailer ? (
          <section className="card p-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Your details</h2>
              <span className="rounded-full bg-soft px-3 py-1 text-xs font-semibold capitalize">{retailer.status}</span>
            </div>
            <ProfileForm
              businessName={retailer.businessName}
              contactName={contactName}
              phone={phone}
              email={user.email ?? ""}
            />
          </section>
        ) : (
          <section className="card p-7">
            <h2 className="text-lg font-bold">Your details</h2>
            <p className="mt-2 text-sm text-muted">Confirm your email address to finish setting up your wholesale account.</p>
          </section>
        )}
        <section className="card p-7">
          <h2 className="mb-5 text-lg font-bold">Change password</h2>
          <PasswordForm />
        </section>
      </div>
    </>
  );
}
