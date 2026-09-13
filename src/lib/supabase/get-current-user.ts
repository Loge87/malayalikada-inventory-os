import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user, memoized for the lifetime of one request (React's
 * `cache()` — reset automatically between requests since every route in
 * this app is dynamically rendered, never cached at build time).
 *
 * `auth.getUser()` is a real network round-trip to Supabase's Auth API, not
 * a local JWT decode. Before this existed, the `(app)` layout and every page
 * it wraps each called `supabase.auth.getUser()` independently — on top of
 * `proxy.ts`'s own call for session refresh, that meant 2-3 sequential
 * round-trips per navigation. Routing every "is someone signed in" check
 * through this one cached call collapses the layout+page calls into one.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
