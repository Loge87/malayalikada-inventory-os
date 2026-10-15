import Link from "next/link";

import { logout } from "@/app/actions";
import { getCurrentRetailer, getCurrentUser, getPortalSettings } from "@/lib/portal";

export async function SiteHeader() {
  const [settings, user, retailer] = await Promise.all([
    getPortalSettings(),
    getCurrentUser(),
    getCurrentRetailer(),
  ]);

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-brand">
          {settings.businessName}
          <span className="ml-2 text-sm font-medium text-muted">Wholesale</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-muted sm:inline">
                {retailer?.businessName ?? user.email}
              </span>
              <form action={logout}>
                <button className="btn" type="submit">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn">Sign in</Link>
              <Link href="/signup" className="btn btn-primary">Apply for an account</Link>
            </>
          )}
        </nav>
      </div>
      {user && retailer?.status === "pending" ? (
        <div className="bg-accent/15 px-4 py-2 text-center text-sm">
          Thanks for applying. We will approve your account shortly, and then you will see prices and can order.
        </div>
      ) : null}
      {user && retailer?.status === "suspended" ? (
        <div className="bg-danger/10 px-4 py-2 text-center text-sm">
          Your account is on hold. Please contact us.
        </div>
      ) : null}
      {user && !user.email_confirmed_at ? (
        <div className="bg-accent/15 px-4 py-2 text-center text-sm">
          Please confirm your email address using the link we sent you.
        </div>
      ) : null}
    </header>
  );
}
