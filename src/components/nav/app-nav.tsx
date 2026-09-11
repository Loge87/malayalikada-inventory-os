"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowRightLeft,
  ClipboardCheck,
  ClipboardList,
  History,
  Layers,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Plug,
  ScanLine,
  X,
  type LucideIcon,
} from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: LucideIcon };

// Single source of truth for every authenticated route — the desktop sidebar,
// the mobile bottom bar, and the mobile "more" panel all render from this list,
// so there is one nav implementation, not several that can drift apart.
const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/products", label: "Products", icon: Package },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/movements", label: "Movements", icon: History },
  { href: "/transfers", label: "Transfers", icon: ArrowRightLeft },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
  { href: "/stock-counts", label: "Stock Counts", icon: ClipboardCheck },
  { href: "/batches", label: "Batches", icon: Layers },
  { href: "/integrations", label: "Integrations", icon: Plug },
];

// The app is used on phones for scanning, so the bottom bar keeps the busiest
// four one tap away; everything else (still in the sidebar on desktop) lives
// behind "More" on mobile.
const MOBILE_PRIMARY_HREFS = ["/dashboard", "/scan", "/products", "/movements"];

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavRow({
  link,
  active,
  onClick,
  className,
}: {
  link: NavLink;
  active: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      <Icon className="size-4 shrink-0" />
      {link.label}
    </Link>
  );
}

export function AppNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryLinks = NAV_LINKS.filter((link) =>
    MOBILE_PRIMARY_HREFS.includes(link.href)
  );
  const overflowLinks = NAV_LINKS.filter(
    (link) => !MOBILE_PRIMARY_HREFS.includes(link.href)
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden shrink-0 flex-col border-r border-border bg-muted/30 md:flex md:w-56">
        <div className="p-4">
          <span className="font-heading text-sm font-semibold">
            Malayalikada
          </span>
          <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {NAV_LINKS.map((link) => (
            <NavRow
              key={link.href}
              link={link}
              active={isActivePath(pathname, link.href)}
            />
          ))}
        </nav>
        <div className="border-t border-border p-2">
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border p-3 md:hidden">
        <span className="font-heading text-sm font-semibold">
          Malayalikada
        </span>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Open menu"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        {primaryLinks.map((link) => {
          const active = isActivePath(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px]",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" />
              {link.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground"
        >
          <Menu className="size-5" />
          More
        </button>
      </nav>

      {/* Mobile "more" panel */}
      {moreOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
          <div className="flex items-center justify-between border-b border-border p-3">
            <span className="font-heading text-sm font-semibold">Menu</span>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              aria-label="Close menu"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="size-5" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
            {overflowLinks.map((link) => (
              <NavRow
                key={link.href}
                link={link}
                active={isActivePath(pathname, link.href)}
                onClick={() => setMoreOpen(false)}
                className="px-3 py-2"
              />
            ))}
          </nav>
          <div className="border-t border-border p-3">
            <p className="truncate pb-2 text-xs text-muted-foreground">
              {userEmail}
            </p>
            <form action={signOut}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
