import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getCurrentUserRole } from "@/lib/roles";
import {
  getCurrentOrganisationId,
  getOrganisationDefaultCurrency,
} from "@/lib/organisation";
import { hasPermission } from "@/lib/permissions";
import type { PriceVariable, PriceVariableType } from "@/lib/price-variable-types";
import type { VariableScope } from "@/lib/product-type";
import { loadActiveFormulaChain, loadPriceFormulaChain } from "@/lib/price-formula";
import {
  SettingsTabs,
  type SettingsTab,
} from "@/components/settings/settings-tabs";
import { GeneralSettingsForm } from "@/components/settings/general-settings-form";
import { PriceFormulaBuilder } from "@/components/settings/price-formula-builder";
import {
  WholesaleSettings,
  type PortalVariant,
} from "@/components/settings/wholesale-settings";
import { NotificationsPlaceholder } from "@/components/settings/notifications-placeholder";

type PriceVariableRow = {
  id: string;
  name: string;
  value: number;
  value_type: PriceVariableType;
  applies_to_type: VariableScope | null;
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // Admin/owner — not staff. Whole page, all three tabs, same as before
  // the tab restructure (lib/permissions.ts "pricing:manage").
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "pricing:manage")) {
    redirect("/dashboard");
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    throw new Error("Could not determine your organisation.");
  }

  const params = await searchParams;
  const activeTab: SettingsTab =
    params.tab === "price-settings" ||
    params.tab === "wholesale" ||
    params.tab === "notifications"
      ? params.tab
      : "general";

  // Both tabs' data fetched unconditionally, regardless of which is
  // initially active — same reasoning as /stock-out's tabs: switching is
  // pure client state (SettingsTabs), so nothing can wait on a fetch once
  // the page has loaded.
  const [currency, variablesRes] = await Promise.all([
    getOrganisationDefaultCurrency(supabase, organisationId),
    supabase
      .from("price_variables")
      .select("id, name, value, value_type, applies_to_type")
      .order("name")
      .returns<PriceVariableRow[]>(),
  ]);

  if (variablesRes.error) {
    throw variablesRes.error;
  }

  const variables: PriceVariable[] = (variablesRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    value: row.value,
    valueType: row.value_type,
    appliesTo: row.applies_to_type ?? "all",
  }));

  // Both formulas' DRAFT and ACTIVE chains loaded unconditionally, same
  // reasoning as currency/variables above — switching between Retail and
  // Wholesale is pure client state (PriceFormulaBuilder), so none of these
  // can wait on a fetch once the page has loaded. The active chains are
  // only for the Retail/Wholesale selector cards' status badge (Applied /
  // Draft changes / Not set, by comparing active against the live draft) —
  // every actual product price still reads active formulas through
  // loadPricingContext elsewhere, not through this page.
  const [retailChain, wholesaleChain, activeRetailChain, activeWholesaleChain] =
    await Promise.all([
      loadPriceFormulaChain(supabase, organisationId, "retail"),
      loadPriceFormulaChain(supabase, organisationId, "wholesale"),
      loadActiveFormulaChain(supabase, organisationId, "retail"),
      loadActiveFormulaChain(supabase, organisationId, "wholesale"),
    ]);

  const [settingsRes, locationsRes, variantsRes] = await Promise.all([
    supabase
      .from("portal_settings")
      .select(
        "is_enabled, min_order_value, fulfilment_location_ids, stock_basis, notify_email, guest_message"
      )
      .maybeSingle(),
    supabase.from("locations").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("product_variants")
      .select("id, name, sku, units_per_pack, portal_visible, products(name)")
      .order("sku")
      .limit(2000),
  ]);
  if (settingsRes.error) throw settingsRes.error;
  if (locationsRes.error) throw locationsRes.error;
  if (variantsRes.error) throw variantsRes.error;

  const wholesaleValues = {
    isEnabled: settingsRes.data?.is_enabled ?? true,
    minOrderValue: Number(settingsRes.data?.min_order_value ?? 100),
    fulfilmentLocationIds: settingsRes.data?.fulfilment_location_ids ?? [],
    stockBasis: (settingsRes.data?.stock_basis ?? "unit") as "unit" | "case",
    notifyEmail: settingsRes.data?.notify_email ?? "",
    guestMessage:
      settingsRes.data?.guest_message ??
      "Sign in to see wholesale prices, or contact us to request a price list.",
  };
  const portalVariants: PortalVariant[] = (variantsRes.data ?? []).map((v) => {
    const product = Array.isArray(v.products) ? v.products[0] : v.products;
    return {
      id: v.id,
      label: product?.name ? `${product.name} - ${v.name}` : v.name,
      sku: v.sku,
      unitsPerPack: Number(v.units_per_pack),
      visible: v.portal_visible,
    };
  });

  return (
    <div className="flex w-full flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Settings</h1>
        <p className="text-page-subtitle">
          Organisation-wide preferences and pricing.
        </p>
      </div>

      <SettingsTabs
        activeTab={activeTab}
        generalContent={<GeneralSettingsForm currency={currency} />}
        priceSettingsContent={
          <PriceFormulaBuilder
            variables={variables}
            currency={currency}
            retailChain={retailChain}
            wholesaleChain={wholesaleChain}
            activeRetailChain={activeRetailChain}
            activeWholesaleChain={activeWholesaleChain}
          />
        }
        wholesaleContent={
          <WholesaleSettings
            currency={currency}
            values={wholesaleValues}
            locations={(locationsRes.data ?? []).map((l) => ({
              id: l.id,
              label: l.name,
            }))}
            variants={portalVariants}
          />
        }
        notificationsContent={<NotificationsPlaceholder />}
      />
    </div>
  );
}
