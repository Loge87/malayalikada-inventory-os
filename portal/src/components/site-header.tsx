import Link from "next/link";

import { logout } from "@/app/actions";
import { getCurrentRetailer, getCurrentUser, getPortalSettings } from "@/lib/portal";

const NAV = [
  { href: "/brands", label: "Brands" },
  { href: "/categories", label: "Categories" },
  { href: "/products", label: "Products" },
  { href: "/trade", label: "For trade" },
  { href: "/contact", label: "Contact" },
];

export async function SiteHeader() {
  const [settings, user, retailer] = await Promise.all([
    getPortalSettings(),
    getCurrentUser(),
    getCurrentRetailer(),
  ]);

  const orderHref = user ? "/products" : "/login";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold tracking-tight text-brand">{settings.businessName}</span>
          <span className="hidden text-xs font-semibold uppercase tracking-widest text-muted sm:inline">Wholesale</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-ink/80 hover:text-brand">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden max-w-40 truncate text-sm text-muted xl:inline">
                {retailer?.businessName ?? user.email}
              </span>
              <form action={logout}>
                <button className="btn" type="submit">Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn hidden sm:inline-flex">Sign in</Link>
          )}
          <Link href={orderHref} className="btn btn-primary">Order</Link>

          <details className="relative lg:hidden">
            <summary className="btn cursor-pointer list-none" aria-label="Menu">Menu</summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-surface p-2 shadow-lg">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-bg">
                  {n.label}
                </Link>
              ))}
              {!user ? (
                <>
                  <Link href="/login" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-bg">Sign in</Link>
                  <Link href="/signup" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-bg">Apply for an account</Link>
                </>
              ) : null}
            </div>
          </details>
        </div>
      </div>

      {user && retailer?.status === "pending" ? (
        <div className="bg-accent/15 px-4 py-2 text-center text-sm">
          Thanks for applying. We will approve your account shortly, and then you will see prices and can order.
        </div>
      ) : null}
      {user && retailer?.status === "suspended" ? (
        <div className="bg-danger/10 px-4 py-2 text-center text-sm">Your account is on hold. Please contact us.</div>
      ) : null}
      {user && !user.email_confirmed_at ? (
        <div className="bg-accent/15 px-4 py-2 text-center text-sm">
          Please confirm your email address using the link we sent you.
        </div>
      ) : null}
    </header>
  );
}
