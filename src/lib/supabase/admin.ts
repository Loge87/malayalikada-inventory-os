import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-only machine-to-machine contexts
 * (integration webhooks) where there is no user session and RLS cannot scope
 * the request.
 *
 * This client BYPASSES RLS. Every query made with it MUST be explicitly scoped
 * by `organisation_id` against a tenant that has already been authenticated for
 * the request.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
