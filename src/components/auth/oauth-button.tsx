"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Demonstrates the browser Supabase client: OAuth sign-in has to start from the
 * client so the browser can follow the redirect to the provider.
 */
export function OAuthButton() {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    if (error) {
      setLoading(false);
      console.error(error.message);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={loading}
      onClick={signInWithGoogle}
    >
      Continue with Google
    </Button>
  );
}
