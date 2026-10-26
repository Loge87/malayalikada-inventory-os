"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser, getOrganisationId } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error: string } | { ok: true; message: string } | undefined;

export async function updateProfile(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };

  const businessName = String(formData.get("businessName") ?? "").trim().slice(0, 120);
  const contactName = String(formData.get("contactName") ?? "").trim().slice(0, 120);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40);
  if (!businessName) return { error: "Business name is required." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("retailers")
    .update({
      business_name: businessName,
      contact_name: contactName || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", getOrganisationId())
    .eq("user_id", user.id);
  if (error) return { error: "Could not save your details. Please try again." };

  revalidatePath("/", "layout");
  return { ok: true, message: "Details saved." };
}

export async function changePassword(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters long." };
  if (password !== confirm) return { error: "The two passwords do not match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: true, message: "Password updated." };
}
