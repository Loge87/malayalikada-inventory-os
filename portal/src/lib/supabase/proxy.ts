import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request (the catalogue is public, so nothing is redirected here) and keeps the auth
 * cookies in sync between the request and the response. Invoked from the
 * root `proxy.ts` (the renamed `middleware` convention in this Next.js).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getUser(). A
  // simple mistake could make it very hard to debug issues with users being
  // randomly logged out.
  await supabase.auth.getUser();

  // IMPORTANT: return the supabaseResponse object as-is. If you create a new
  // response, make sure to copy over the cookies.
  return supabaseResponse;
}
