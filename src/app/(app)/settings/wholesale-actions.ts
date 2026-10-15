"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";

export type WholesaleSettingsState = { error: string } | { ok: true } | undefined;

export async function saveWholesaleSettings(
  _prev: WholesaleSettingsState,
  formData: FormData
): Promise<WholesaleSettingsState> {
  const minOrderValue = Number(formData.get("minOrderValue"));
  const notifyEmail = String(formData.get("notifyEmail") ?? "").trim();
  const guestMessage = String(formData.get("guestMessage") ?? "").trim();
  const stockBasis = String(formData.get("stockBasis") ?? "unit");
  const isEnabled = formData.get("isEnabled") === "on";
  const locationIds = formData.getAll("locationIds").map(String).filter(Boolean);

  if (!Number.isFinite(minOrderValue) || minOrderValue < 0) {
    return { error: "Minimum order value must be 0 or more." };
  }
  if (notifyEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(notifyEmail)) {
    return { error: "Enter a valid notification email." };
  }
  if (stockBasis !== "unit" && stockBasis !== "case") {
    return { error: "Invalid stock basis." };
  }

  const supabase = await createClient();
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "wholesale:manage")) {
    return { error: "You don't have permission to change wholesale settings." };
  }
  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) return { error: "Could not determine your organisation." };

  const { error } = await supabase.from("portal_settings").upsert(
    {
      organisation_id: organisationId,
      is_enabled: isEnabled,
      min_order_value: minOrderValue,
      fulfilment_location_ids: locationIds,
      stock_basis: stockBasis,
      notify_email: notifyEmail || null,
      guest_message: guestMessage || undefined,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organisation_id" }
  );
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}

export async function setVariantsPortalVisible(
  variantIds: string[],
  visible: boolean
): Promise<{ error: string } | { ok: true }> {
  if (variantIds.length === 0) return { ok: true };

  const supabase = await createClient();
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "wholesale:manage")) {
    return { error: "You don't have permission to change this." };
  }

  const { error } = await supabase
    .from("product_variants")
    .update({ portal_visible: visible })
    .in("id", variantIds);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}
