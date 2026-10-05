"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowRightLeft,
  ClipboardCheck,
  ClipboardList,
  Handshake,
  History,
  Layers,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  PackageMinus,
  Plug,
  ScanLine,
  ScrollText,
  Settings as SettingsIcon,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { hasPermission, type Permission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/nav/theme-toggle";
import { cn } from "@/lib/utils";

type NavSection = "general" | "management" | "settings";

const SECTION_LABEL: Record<NavSection, string> = {
  general: "General",
  management: "Management",
  settings: "Settings",
};

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Omitted = every role can see it. Set = hidden unless the current role
   *  has this permission (lib/permissions.ts) — e.g. staff never sees
   *  Integrations, since that page redirects them away anyway. */
  permission?: Permission;
  /** Visible but inert — grayed out, not a real link, with a "Soon" badge.
   *  Orthogonal to `permission`: permission still controls whether the item
   *  shows up at all; `disabled` only controls whether a shown item is
   *  clickable. See the TEMP block below. */
  disabled?: boolean;
  /** Purely a visual grouping label (.sidebar-section-label) — doesn't
   *  affect href, permission, or render order within NAV_LINKS itself;
   *  only which heading a link falls under when the sidebar groups by
   *  section. */
  section: NavSection;
};

// Single source of truth for every authenticated route — the desktop sidebar,
// the mobile bottom bar, and the mobile "more" panel all render from this list,
// so there is one nav implementation, not several that can drift apart.
//
// Enabled items first, disabled ones grouped at the bottom (NavRow renders
// the latter as inert with a "Soon" badge) — order here is render order.
const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "general" },
  { href: "/scan", label: "Scan", icon: ScanLine, section: "general" },
  { href: "/stock-out", label: "Stock Out", icon: PackageMinus, section: "general" },
  { href: "/products", label: "Products", icon: Package, section: "general" },
  { href: "/locations", label: "Locations", icon: MapPin, section: "management" },
  {
    href: "/clients",
    label: "Clients",
    icon: Handshake,
    permission: "clients:manage",
    section: "management",
  },
  { href: "/transfers", label: "Transfers", icon: ArrowRightLeft, section: "management" },
  {
    href: "/settings/team",
    label: "Team",
    icon: Users,
    permission: "roles:manage",
    section: "management",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: SettingsIcon,
    permission: "pricing:manage",
    section: "settings",
  },

  // --- TEMP: disabled for the client demo, not a permanent change ---
  // These are real, working, tested features — just held back so the demo's
  // first impression stays focused. Revert by deleting `disabled: true`
  // from each (and moving them back up wherever fits) once the demo's done.
  {
    href: "/movements",
    label: "Movements",
    icon: History,
    disabled: true,
    section: "management",
  },
  {
    href: "/purchase-orders",
    label: "Purchase Orders",
    icon: ClipboardList,
    disabled: true,
    section: "management",
  },
  {
    href: "/stock-counts",
    label: "Stock Counts",
    icon: ClipboardCheck,
    disabled: true,
    section: "management",
  },
  {
    href: "/batches",
    label: "Batches",
    icon: Layers,
    disabled: true,
    section: "management",
  },
  {
    href: "/integrations",
    label: "Integrations",
    icon: Plug,
    permission: "integrations:view",
    disabled: true,
    section: "settings",
  },
  {
    href: "/audit-log",
    label: "Audit Log",
    icon: ScrollText,
    permission: "audit:view",
    disabled: true,
    section: "settings",
  },
  // --- END TEMP ---
];

// The app is used on phones for scanning, so the bottom bar keeps the busiest
// four one tap away, as plain nav destinations; everything else (still in the
// sidebar on desktop) lives behind the single "menu" button on mobile.
//
// Stock Out (not Scan) gets the primary slot — it's staff's main daily-use
// action now; Scan is still a real, working destination, just one tap
// further away in the overflow menu instead.
//
// TEMP: Movements swapped for Transfers here while Movements is demo-
// disabled above — a quick-access tab has to be a real destination. Swap
// back once Movements is re-enabled.
const MOBILE_PRIMARY_HREFS = ["/dashboard", "/stock-out", "/products", "/transfers"];

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

  // Visible so the full feature set is apparent, but genuinely inert — not
  // a <Link>, no href, nothing to click. The badge is always-visible text
  // (not a hover-only tooltip): this nav is used on phones as much as
  // desktop, where hover doesn't exist. `title` adds a native tooltip on
  // desktop hover too, at no extra cost.
  if (link.disabled) {
    return (
      <span
        aria-disabled="true"
        title="Coming soon"
        className={cn(
          "nav-item-disabled flex items-center gap-2.5 rounded-lg px-(--space-nav-item-padding-x) py-(--space-nav-item-padding-y) text-sm select-none",
          className
        )}
      >
        <Icon className="size-4 shrink-0" />
        {link.label}
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
          Soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={link.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-(--space-nav-item-padding-x) py-(--space-nav-item-padding-y) text-sm transition-[transform,background-color,color] duration-(--duration-fast) ease-(--ease-out) hover:translate-x-0.5",
        active ? "nav-item-active" : "nav-item",
        className
      )}
    >
      <Icon className="size-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
      {link.label}
    </Link>
  );
}

const SECTION_ORDER: NavSection[] = ["general", "management", "settings"];

/** Groups an already-filtered link list by `section`, fixed order, skipping
 *  any section with nothing visible in it (e.g. a staff role with no
 *  "settings" links) — so a label never renders over an empty group. */
function groupBySection(links: NavLink[]): { section: NavSection; links: NavLink[] }[] {
  return SECTION_ORDER.map((section) => ({
    section,
    links: links.filter((link) => link.section === section),
  })).filter((group) => group.links.length > 0);
}

/** Renders a link list as labeled section groups (.sidebar-section-label
 *  above each) — shared by the desktop sidebar and the mobile overflow
 *  panel so the grouping itself isn't duplicated between the two. */
function NavGroups({
  links,
  pathname,
  onClick,
  itemClassName,
}: {
  links: NavLink[];
  pathname: string;
  onClick?: () => void;
  itemClassName?: string;
}) {
  return (
    <>
      {groupBySection(links).map((group) => (
        <div key={group.section} className="flex flex-col gap-(--space-nav-gap)">
          <span className="sidebar-section-label">{SECTION_LABEL[group.section]}</span>
          {group.links.map((link) => (
            <NavRow
              key={link.href}
              link={link}
              active={isActivePath(pathname, link.href)}
              onClick={onClick}
              className={itemClassName}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function roleLabel(role: string | null): string {
  if (!role) return "—";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Email + role + theme toggle + sign-out, grouped together as one block —
 *  used at the bottom of the desktop sidebar and the bottom of the mobile
 *  menu panel. The theme toggle lives here rather than a settings page so
 *  it's always one tap away, on both layouts, without a separate entry. */
function ProfileSection({
  userEmail,
  role,
}: {
  userEmail: string;
  role: string | null;
}) {
  return (
    <div className="profile-block flex flex-col gap-2 border-t p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm">{userEmail}</p>
          <p className="text-muted-foreground text-xs">{roleLabel(role)}</p>
        </div>
        <ThemeToggle />
      </div>
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
  );
}

export function AppNav({
  userEmail,
  role,
}: {
  userEmail: string;
  role: string | null;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleLinks = NAV_LINKS.filter(
    (link) => !link.permission || hasPermission(role, link.permission)
  );
  const primaryLinks = visibleLinks.filter((link) =>
    MOBILE_PRIMARY_HREFS.includes(link.href)
  );
  const overflowLinks = visibleLinks.filter(
    (link) => !MOBILE_PRIMARY_HREFS.includes(link.href)
  );

  return (
    <>
      {/* Desktop sidebar — sticky + viewport-height, so it stays fixed to the
          screen and only the main content scrolls, rather than the sidebar
          scrolling away with a tall page. */}
      <aside className="sidebar hidden shrink-0 flex-col md:sticky md:top-0 md:flex md:h-screen md:w-56 md:overflow-y-auto">
        <div className="p-4">
          <span className="font-heading text-sm font-semibold">
            Malayalikada
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-3 px-2">
          <NavGroups links={visibleLinks} pathname={pathname} />
        </nav>
        <ProfileSection userEmail={userEmail} role={role} />
      </aside>

      {/* Mobile top bar — app name only; the single menu trigger lives here. */}
      <header className="flex items-center justify-between border-b border-border p-3 md:hidden">
        <span className="font-heading text-sm font-semibold">
          Malayalikada
        </span>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {/* Mobile bottom tab bar — plain destinations, no second menu trigger. */}
      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t pb-[env(safe-area-inset-bottom)] md:hidden">
        {primaryLinks.map((link) => {
          const active = isActivePath(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className="bottom-nav-item flex flex-col items-center gap-0.5 py-2 text-[11px]"
            >
              <Icon className="size-5" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile menu panel — the sole overflow/menu surface on mobile. */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
          <div className="flex items-center justify-between border-b border-border p-3">
            <span className="font-heading text-sm font-semibold">Menu</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="size-5" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-3 overflow-y-auto p-2">
            <NavGroups
              links={overflowLinks}
              pathname={pathname}
              onClick={() => setMenuOpen(false)}
              itemClassName="px-3 py-2"
            />
          </nav>
          <ProfileSection userEmail={userEmail} role={role} />
        </div>
      ) : null}
    </>
  );
}
