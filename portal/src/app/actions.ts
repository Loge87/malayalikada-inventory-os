"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganisationId } from "@/lib/portal";

export type FormState = { error: string } | { ok: true; message?: string } | undefined;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  // Return to where the person came from, but only to a path on this site.
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!businessName) return { error: "Business name is required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters long." };

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      data: { business_name: businessName, contact_name: contactName, phone },
    },
  });
  if (error) return { error: error.message };

  return {
    ok: true,
    message:
      "Check your email and click the link to confirm your address. After that we will review your application.",
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPriceList(_prev: FormState, formData: FormData): Promise<FormState> {
  // honeypot: real people leave this empty
  if (String(formData.get("website") ?? "")) return { ok: true };

  const email = String(formData.get("email") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim().slice(0, 1000);

  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (!businessName) return { error: "Business name is required." };

  const admin = createAdminClient();
  const organisationId = getOrganisationId();

  const { error } = await admin.from("portal_price_requests").insert({
    organisation_id: organisationId,
    business_name: businessName,
    contact_name: contactName || null,
    email,
    phone: phone || null,
    message: message || null,
  });
  if (error) return { error: "Sorry, we could not send your request. Please try again." };

  const settings = await admin
    .from("portal_settings")
    .select("notify_email")
    .eq("organisation_id", organisationId)
    .maybeSingle();
  await admin.from("portal_email_outbox").insert({
    organisation_id: organisationId,
    kind: "price_list_request",
    to_email: settings.data?.notify_email ?? null,
    subject: `Price list request from ${businessName}`,
    body: `${businessName} (${email}${phone ? ", " + phone : ""}) asked for a price list.${message ? "\n\n" + message : ""}`,
  });

  return { ok: true, message: "Thanks. We will be in touch with our price list soon." };
}
