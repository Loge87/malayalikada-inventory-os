import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarX,
  PackagePlus,
  ShoppingCart,
  SlidersHorizontal,
  Undo2,
  type LucideIcon,
} from "lucide-react";

// Shared movement-type grouping/labels/colors for the dashboard's activity
// chart and recent-activity feed. record_inventory_movement's movement_type
// check constraint allows 8 raw types (see 0001_init.sql); the dashboard
// trend chart groups them into the 4 buckets a store owner actually thinks
// in — "received / sold / transferred / adjusted" — while the activity feed
// still shows the raw type per row.
export type MovementBucket = "received" | "sold" | "transferred" | "adjusted";

export const MOVEMENT_BUCKET_ORDER: MovementBucket[] = [
  "received",
  "sold",
  "transferred",
  "adjusted",
];

export const MOVEMENT_BUCKET_LABELS: Record<MovementBucket, string> = {
  received: "Received",
  sold: "Sold",
  transferred: "Transferred",
  adjusted: "Adjusted",
};

// CSS custom properties defined in globals.css (--chart-1..4) — a movement
// type is a *category* (which kind of change), not a good/bad status, so it
// gets its own validated categorical palette (blue/orange/violet/red)
// instead of borrowing --status-success/warning/critical the way an earlier
// version did. That keeps a chart bar from ever being mistaken for a stock
// status pill or the --primary brand color, which are both greens too.
export const MOVEMENT_BUCKET_COLOR_VAR: Record<MovementBucket, string> = {
  received: "var(--chart-1)",
  sold: "var(--chart-2)",
  transferred: "var(--chart-3)",
  adjusted: "var(--chart-4)",
};

// The full set record_inventory_movement's movement_type CHECK constraint
// allows (0001_init.sql) — for the audit log's "filter by type" dropdown,
// where every raw type is a distinct filter option (unlike the dashboard's
// 4-bucket grouping above).
export const ALL_MOVEMENT_TYPES = [
  "PURCHASE_RECEIVED",
  "SALE",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "DAMAGE",
  "EXPIRY",
  "ADJUSTMENT",
  "RETURN",
] as const;

const RAW_TO_BUCKET: Record<string, MovementBucket> = {
  PURCHASE_RECEIVED: "received",
  SALE: "sold",
  TRANSFER_IN: "transferred",
  TRANSFER_OUT: "transferred",
  ADJUSTMENT: "adjusted",
  DAMAGE: "adjusted",
  EXPIRY: "adjusted",
  RETURN: "adjusted",
};

export function movementBucket(rawType: string): MovementBucket {
  return RAW_TO_BUCKET[rawType] ?? "adjusted";
}

export function movementTypeLabel(rawType: string): string {
  const words = rawType.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One icon per raw movement type, for the recent-activity feed. */
export const MOVEMENT_TYPE_ICON: Record<string, LucideIcon> = {
  PURCHASE_RECEIVED: PackagePlus,
  SALE: ShoppingCart,
  TRANSFER_IN: ArrowRightLeft,
  TRANSFER_OUT: ArrowRightLeft,
  ADJUSTMENT: SlidersHorizontal,
  DAMAGE: AlertTriangle,
  EXPIRY: CalendarX,
  RETURN: Undo2,
};
