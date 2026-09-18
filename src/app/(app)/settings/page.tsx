import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getCurrentUserRole } from "@/lib/roles";
import {
  getCurrentOrganisationId,
  getOrganisationDefaultCurrency,
} from "@/lib/organisation";
import { hasPermission } from "@/lib/permissions";
import {
  PriceSettingsForm,
  type PriceSettings,
} from "@/components/settings/price-settings-form";

type PriceSettingsRow = {
  cgst_percent: number;
  sgst_percent: number;
  profit_margin_percent: number;
  logistics_charges_percent: number;
  additional_charges_percent: number;
};

export default async function PriceSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // Admin/owner — not staff. Same pattern as /settings/team's owner-only
  // gate, one tier down (lib/permissions.ts "pricing:manage").
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "pricing:manage")) {
    redirect("/dashboard");
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    throw new Error("Could not determine your organisation.");
  }

  // No row yet = never saved — the form just starts at zero for every
  // percent field (currency still has a real value: organisations.
  // default_currency is NOT NULL, defaulted at the column level).
  const [{ data, error }, currency] = await Promise.all([
    supabase
      .from("price_settings")
      .select(
        "cgst_percent, sgst_percent, profit_margin_percent, logistics_charges_percent, additional_charges_percent"
      )
      .eq("organisation_id", organisationId)
      .maybeSingle<PriceSettingsRow>(),
    getOrganisationDefaultCurrency(supabase, organisationId),
  ]);

  if (error) {
    throw error;
  }

  const settings: PriceSettings = {
    currency,
    cgstPercent: data?.cgst_percent ?? 0,
    sgstPercent: data?.sgst_percent ?? 0,
    profitMarginPercent: data?.profit_margin_percent ?? 0,
    logisticsChargesPercent: data?.logistics_charges_percent ?? 0,
    additionalChargesPercent: data?.additional_charges_percent ?? 0,
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Settings</h1>
        <p className="text-page-subtitle">
          Organisation-wide pricing inputs.
        </p>
      </div>

      <PriceSettingsForm settings={settings} />
    </div>
  );
}
