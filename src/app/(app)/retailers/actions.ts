"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";

export type RetailerStatus = "pending" | "approved" | "suspended";
export type RetailerActionState = { error: string } | { ok: true } | undefined;

async function requireWholesaleAdmin() {
  const supabase = await createClient();
  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "wholesale:manage")) {
    return { supabase, error: "You don't have permission to manage retailers." };
  }
  return { supabase, error: null as string | null };
}

function readFields(formData: FormData) {
  return {
    business_name: String(formData.get("businessName") ?? "").trim(),
    contact_name: String(formData.get("contactName") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    phone: String(formData.get("phone") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

function validate(f: ReturnType<typeof readFields>): string | null {
  if (!f.business_name) return "Business name is required.";
  if (!f.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) {
    return "A valid email is required.";
  }
  return null;
}

function friendly(message: string): string {
  if (message.includes("retailers_org_email_idx")) {
    return "A retailer with this email already exists.";
  }
  return message;
}

/** Add a retailer by hand. Added retailers are approved straight away — the
 *  distributor is vouching for them — and can claim the account by signing up
 *  in the portal with the same email. */
export async function addRetailer(
  _prev: RetailerActionState,
  formData: FormData
): Promise<RetailerActionState> {
  const fields = readFields(formData);
  const invalid = validate(fields);
  if (invalid) return { error: invalid };

  const { supabase, error: denied } = await requireWholesaleAdmin();
  if (denied) return { error: denied };

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) return { error: "Could not determine your organisation." };

  const { error } = await supabase.from("retailers").insert({
    organisation_id: organisationId,
    ...fields,
    status: "approved",
    approved_at: new Date().toISOString(),
  });
  if (error) return { error: friendly(error.message) };

  revalidatePath("/retailers");
  return { ok: true };
}

export async function updateRetailer(
  _prev: RetailerActionState,
  formData: FormData
): Promise<RetailerActionState> {
  const retailerId = String(formData.get("retailerId") ?? "");
  if (!retailerId) return { error: "Missing retailer." };
  const fields = readFields(formData);
  const invalid = validate(fields);
  if (invalid) return { error: invalid };

  const { supabase, error: denied } = await requireWholesaleAdmin();
  if (denied) return { error: denied };

  const { error } = await supabase
    .from("retailers")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", retailerId);
  if (error) return { error: friendly(error.message) };

  revalidatePath("/retailers");
  return { ok: true };
}

export async function setRetailerStatus(
  retailerId: string,
  status: RetailerStatus
): Promise<RetailerActionState> {
  const { supabase, error: denied } = await requireWholesaleAdmin();
  if (denied) return { error: denied };

  const { error } = await supabase.rpc("set_retailer_status", {
    p_retailer_id: retailerId,
    p_status: status,
  });
  if (error) return { error: error.message };

  revalidatePath("/retailers");
  return { ok: true };
}

/** Delete a retailer. One with order history can't be deleted (orders are
 *  permanent records) — it is suspended instead, and we say so. */
export async function deleteRetailer(
  retailerId: string
): Promise<{ error: string } | { ok: true; result: "deleted" | "suspended" }> {
  const { supabase, error: denied } = await requireWholesaleAdmin();
  if (denied) return { error: denied };

  const { error } = await supabase.from("retailers").delete().eq("id", retailerId);
  if (error) {
    if (error.code === "23503") {
      const { error: suspendError } = await supabase.rpc("set_retailer_status", {
        p_retailer_id: retailerId,
        p_status: "suspended",
      });
      if (suspendError) return { error: suspendError.message };
      revalidatePath("/retailers");
      return { ok: true, result: "suspended" };
    }
    return { error: error.message };
  }

  revalidatePath("/retailers");
  return { ok: true, result: "deleted" };
}
