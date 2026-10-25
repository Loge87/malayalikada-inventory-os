import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
};

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  // Reached from the emailed link (which signs the person in with a
  // short-lived recovery session) or from "Change password" in the app.
  if (!user) {
    redirect("/forgot-password");
  }

  return <ResetPasswordForm email={user.email ?? ""} />;
}
