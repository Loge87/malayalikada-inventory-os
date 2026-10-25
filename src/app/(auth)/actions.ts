"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string } | undefined;

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // When email confirmation is enabled, no session is returned yet.
  if (data.user && !data.session) {
    redirect("/signup/check-email");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export type ResetRequestState = { error: string } | { ok: true } | undefined;

/**
 * Sends a password-reset email. The answer is the same whether or not the
 * address has an account, so this can't be used to find out who is
 * registered. The link in the email comes back through /auth/recovery and
 * lands on /reset-password (via /auth/recovery) with a short-lived recovery session.
 */
export async function requestPasswordReset(
  _prevState: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/recovery`,
  });

  // Rate limits are worth telling the person about; anything else is hidden.
  if (error && /rate limit|too many/i.test(error.message)) {
    return { error: "Too many requests. Please wait a few minutes and try again." };
  }

  return { ok: true };
}

export type UpdatePasswordState = { error: string } | undefined;

/** Sets a new password for the signed-in (or recovery-session) user. */
export async function updatePassword(
  _prevState: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }
  if (password !== confirm) {
    return { error: "The two passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
