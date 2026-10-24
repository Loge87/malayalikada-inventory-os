import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_GUEST_MESSAGE =
  "Sign in to see wholesale prices, or contact us to request a price list.";

export function getOrganisationId(): string {
  const id = process.env.PORTAL_ORGANISATION_ID;
  if (!id) throw new Error("PORTAL_ORGANISATION_ID is not set.");
  return id;
}

export type RetailerStatus = "pending" | "approved" | "suspended";

export type Retailer = {
  id: string;
  businessName: string;
  contactName: string | null;
  email: string;
  status: RetailerStatus;
};

export type PortalSettings = {
  isEnabled: boolean;
  minOrderValue: number;
  fulfilmentLocationIds: string[];
  stockBasis: "unit" | "case";
  guestMessage: string;
  businessName: string;
  currency: string;
};

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/**
 * Finds (or creates) the retailer record for a signed-in, email-verified user.
 *
 * Verification matters: a retailer the distributor added by hand is already
 * approved, and is claimed by whoever proves they own that email address.
 * Linking before the email is confirmed would let anyone sign up with
 * someone else's address and inherit their approved status.
 */
async function ensureRetailer(user: User): Promise<Retailer | null> {
  if (!user.email || !user.email_confirmed_at) return null;

  const admin = createAdminClient();
  const organisationId = getOrganisationId();
  const columns = "id, business_name, contact_name, email, status, user_id";
  const toRetailer = (r: {
    id: string;
    business_name: string;
    contact_name: string | null;
    email: string;
    status: string;
  }): Retailer => ({
    id: r.id,
    businessName: r.business_name,
    contactName: r.contact_name,
    email: r.email,
    status: r.status as RetailerStatus,
  });

  const mine = await admin
    .from("retailers")
    .select(columns)
    .eq("organisation_id", organisationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (mine.data) return toRetailer(mine.data);

  const email = user.email.toLowerCase();
  const byEmail = await admin
    .from("retailers")
    .select(columns)
    .eq("organisation_id", organisationId)
    .ilike("email", email)
    .maybeSingle();

  if (byEmail.data) {
    if (byEmail.data.user_id) return null; // already claimed by another login
    const { data } = await admin
      .from("retailers")
      .update({ user_id: user.id, updated_at: new Date().toISOString() })
      .eq("id", byEmail.data.id)
      .is("user_id", null)
      .select(columns)
      .maybeSingle();
    return data ? toRetailer(data) : null;
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const businessName = String(meta.business_name ?? "").trim() || email;
  const contactName = String(meta.contact_name ?? "").trim() || null;
  const phone = String(meta.phone ?? "").trim() || null;

  const { data: created, error } = await admin
    .from("retailers")
    .insert({
      organisation_id: organisationId,
      user_id: user.id,
      business_name: businessName,
      contact_name: contactName,
      email,
      phone,
      status: "pending",
    })
    .select(columns)
    .single();
  if (error || !created) return null;

  const settings = await admin
    .from("portal_settings")
    .select("notify_email")
    .eq("organisation_id", organisationId)
    .maybeSingle();
  await admin.from("portal_email_outbox").insert({
    organisation_id: organisationId,
    kind: "new_retailer_request",
    to_email: settings.data?.notify_email ?? null,
    subject: `New retailer waiting for approval: ${businessName}`,
    body: `${businessName} (${email}) has signed up to the wholesale portal and is waiting for your approval.`,
  });

  return toRetailer(created);
}

export const getCurrentRetailer = cache(async (): Promise<Retailer | null> => {
  const user = await getCurrentUser();
  return user ? ensureRetailer(user) : null;
});

export const getPortalSettings = cache(async (): Promise<PortalSettings> => {
  const admin = createAdminClient();
  const organisationId = getOrganisationId();
  const [settings, org] = await Promise.all([
    admin
      .from("portal_settings")
      .select("is_enabled, min_order_value, fulfilment_location_ids, stock_basis, guest_message")
      .eq("organisation_id", organisationId)
      .maybeSingle(),
    admin.from("organisations").select("name, default_currency").eq("id", organisationId).maybeSingle(),
  ]);
  return {
    isEnabled: settings.data?.is_enabled ?? true,
    minOrderValue: Number(settings.data?.min_order_value ?? 100),
    fulfilmentLocationIds: settings.data?.fulfilment_location_ids ?? [],
    stockBasis: (settings.data?.stock_basis ?? "unit") as "unit" | "case",
    guestMessage: settings.data?.guest_message || DEFAULT_GUEST_MESSAGE,
    businessName: org.data?.name ?? "Wholesale",
    currency: org.data?.default_currency ?? "NZD",
  };
});

export type PriceMode = "guest" | "pending" | "approved" | "suspended";

/** What the current visitor is allowed to see: prices only when approved. */
export async function getPriceMode(): Promise<PriceMode> {
  const [user, retailer] = await Promise.all([getCurrentUser(), getCurrentRetailer()]);
  return !user || !retailer ? "guest" : retailer.status;
}
