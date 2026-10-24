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
    <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-xl">
      <div className="container-page flex h-[4.5rem] items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-lg font-extrabold text-white transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105">
            {settings.businessName.slice(0, 1)}
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold tracking-tight">{settings.businessName}</span>
            <span className="hidden rounded-full bg-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand sm:inline">
              Wholesale
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="nav-link">
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
                <button className="btn btn-sm" type="submit">Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn btn-sm hidden sm:inline-flex">Sign in</Link>
          )}
          <Link href={orderHref} className="btn btn-sm btn-primary">Order now</Link>

          <details className="relative lg:hidden">
            <summary className="btn btn-sm cursor-pointer list-none" aria-label="Menu">Menu</summary>
            <div className="menu-pop absolute right-0 mt-3 w-60 rounded-2xl border border-line bg-white p-2 shadow-[var(--shadow-lg)]">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-soft">
                  {n.label}
                </Link>
              ))}
              {!user ? (
                <>
                  <Link href="/login" className="block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-soft">Sign in</Link>
                  <Link href="/signup" className="block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-soft">Apply for an account</Link>
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
