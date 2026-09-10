import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return <LoginForm />;
}
