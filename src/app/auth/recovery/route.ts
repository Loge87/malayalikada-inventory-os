import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Where the password-reset email link lands. Works with Supabase's default
 * Reset Password email (which comes back with ?code=, PKCE) and with a
 * customised one that sends token_hash + type=recovery. Either way the
 * person ends up signed in with a short-lived session on /reset-password.
 *
 * With the default email the link must be opened in the same browser that
 * asked for the reset (that's where the PKCE verifier is stored).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/reset-password", request.url));
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL("/reset-password", request.url));
    }
  }

  return NextResponse.redirect(new URL("/auth/error", request.url));
}
