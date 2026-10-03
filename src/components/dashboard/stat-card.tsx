import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export type StatTrend = {
  label: string;
  direction: "up" | "down";
};

// Renamed from "primary" — this never meant "the --primary button color"
// even before this correction (it read --brand-accent), and the name was
// actively misleading once --primary became a real hue again in the violet
// rebrand. "blue" names what it actually resolves to.
export type StatTone = "blue" | "success" | "warning" | "critical";

// The icon badge's own gradient/shadow tint AND the icon glyph itself both
// read from this one per-tone variable — a rotation of visually distinct
// colors (theme.css's ICON BADGES group), not a wash of one brand color.
// No --primary or --brand-accent reference anywhere here by design (see
// CLAUDE.md-adjacent correction: icon badges stay out of the brand-wash
// scope entirely now) — every value is --badge-*, itself mostly an alias
// of an already-validated color elsewhere (chart/status tokens), re-
// skinnable in one place. No separate icon-vs-badge split either (unlike
// the prior pass): --badge-blue (the old "primary" tone's replacement)
// reads fine directly against its own wash in both modes (3.5-4.0:1),
// unlike the very light/bright green it replaced (1.4:1), so the darker-
// step workaround that needed is no longer necessary.
const TONE_VAR: Record<StatTone, string> = {
  blue: "var(--badge-blue)",
  success: "var(--badge-teal)",
  warning: "var(--badge-amber)",
  critical: "var(--badge-red)",
};

/**
 * One top-row stat tile. Wraps in a Link (whole card clickable, per the
 * "click a stat card to jump to the detail" requirement) when `href` is
 * given, otherwise renders as a plain non-interactive card.
 */
export function StatCard({
  label,
  value,
  href,
  icon: Icon,
  tone = "blue",
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  href?: string;
  icon?: LucideIcon;
  /** Which status color the icon badge is tinted with — purely a visual
   *  category (this stat is "good news" vs "needs attention"), independent
   *  of any StockStatusPill on the same page. */
  tone?: StatTone;
  /** A small, honestly-derived comparison chip — omitted rather than
   *  fabricated when there's nothing meaningful to show (see
   *  dashboard/page.tsx). `direction` picks the pill color/arrow; `label`
   *  is whatever real figure backs it (a signed dollar delta today — not
   *  necessarily a percentage, unlike the "12%" reference example, since
   *  nothing here computes a percentage change to show honestly). */
  trend?: StatTrend;
  className?: string;
}) {
  const colorVar = TONE_VAR[tone];

  // h-full at every level (Link -> Card -> CardContent) so all 4 cards in
  // the grid row match height regardless of content length (e.g. a label
  // that wraps to two lines) — the grid itself stretches each item to the
  // row's height by default, but a shorter child still needs h-full to
  // actually fill that stretched box rather than sitting shorter inside it.
  const content = (
    <CardContent className="flex h-full flex-col gap-3">
      {Icon ? (
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 ease-out group-hover:scale-110"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 25%, color-mix(in oklch, ${colorVar} 26%, transparent), color-mix(in oklch, ${colorVar} 10%, transparent))`,
            // Flat against its own tinted background by design — just the
            // hairline 1px ring for shape definition, no drop-shadow layer
            // (the old 2nd box-shadow layer, offset+blur, read as a raised
            // shadow and has been removed).
            boxShadow: `0 0 0 1px color-mix(in oklch, ${colorVar} 12%, transparent)`,
          }}
        >
          <Icon className="size-4.5" style={{ color: colorVar }} />
        </span>
      ) : null}
      <div>
        <span className="stat-value block break-words md:text-3xl">
          {value}
        </span>
        <span className="stat-label mt-0.5 block md:text-sm">
          {label}
        </span>
      </div>
      {trend ? (
        <span
          className={cn(
            "trend-pill",
            trend.direction === "up" ? "trend-pill-up" : "trend-pill-down"
          )}
        >
          {trend.direction === "up" ? (
            <ArrowUpRight className="size-3" />
          ) : (
            <ArrowDownRight className="size-3" />
          )}
          {trend.label}
        </span>
      ) : null}
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href} className="group block h-full">
        <Card
          size="sm"
          elevated
          className={cn("stat-card hover:-translate-y-1", className)}
        >
          {content}
        </Card>
      </Link>
    );
  }

  return (
    <Card size="sm" elevated className={cn("stat-card", className)}>
      {content}
    </Card>
  );
}
