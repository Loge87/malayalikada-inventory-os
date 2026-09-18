import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export type StatTone = "primary" | "success" | "warning" | "critical";

// The icon badge's tint and icon color both read from the same CSS variable
// per tone, so the badge is always a muted (~12%) wash of the exact color
// the icon itself uses — never a mismatched pair, and re-skinnable in one
// place (globals.css) like every other status color in the app.
const TONE_VAR: Record<StatTone, string> = {
  primary: "var(--primary)",
  success: "var(--status-success)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
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
  tone = "primary",
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
  /** A small, honestly-derived note — omitted rather than fabricated when
   *  there's nothing meaningful to show (see dashboard/page.tsx). */
  trend?: string;
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
            boxShadow: `0 0 0 1px color-mix(in oklch, ${colorVar} 12%, transparent), 0 4px 12px -2px color-mix(in oklch, ${colorVar} 25%, transparent)`,
          }}
        >
          <Icon className="size-4.5" style={{ color: colorVar }} />
        </span>
      ) : null}
      <div>
        <span className="block text-2xl font-bold tabular-nums break-words md:text-3xl">
          {value}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground md:text-sm">
          {label}
        </span>
      </div>
      {trend ? (
        <span className="text-xs text-muted-foreground">{trend}</span>
      ) : null}
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href} className="group block h-full">
        <Card
          size="sm"
          elevated
          className={cn("h-full hover:-translate-y-1", className)}
        >
          {content}
        </Card>
      </Link>
    );
  }

  return (
    <Card size="sm" elevated className={cn("h-full", className)}>
      {content}
    </Card>
  );
}
