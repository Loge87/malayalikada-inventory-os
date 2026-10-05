"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts";

import { formatShortDate } from "@/lib/format";
import {
  MOVEMENT_BUCKET_COLOR_VAR,
  MOVEMENT_BUCKET_LABELS,
  MOVEMENT_BUCKET_ORDER,
  type MovementBucket,
} from "@/lib/movement-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DayRangeToggle, type DayRange } from "@/components/dashboard/day-range-toggle";

export type ActivityDay = { date: string } & Record<MovementBucket, number>;

type TooltipEntry = { dataKey: MovementBucket; value: number; color: string };

function ActivityTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    // animate-in fade-in only — see RevenueTooltip's identical comment
    // (revenue-chart.tsx) for why the fade lives here now instead of on
    // the Tooltip's own (position-coupled) animation.
    <div className="animate-in fade-in rounded-lg bg-popover p-2.5 text-xs shadow-md ring-1 ring-foreground/10 duration-(--duration-fast)">
      <p className="mb-1 font-medium">{formatShortDate(label)}</p>
      <ul className="flex flex-col gap-0.5">
        {payload.map((entry) => (
          <li
            key={entry.dataKey}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {MOVEMENT_BUCKET_LABELS[entry.dataKey]}
            </span>
            <span className="font-medium tabular-nums">{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// recharts gives each <Bar> one fixed `radius` prop, not a per-datum one —
// rounding only the LAST bucket ("adjusted") would leave most days flat-
// topped, since adjusted is usually 0 and some earlier, nonzero bucket is
// actually the visible top of that day's stack. This custom shape checks
// each day's own payload and rounds the top corners only on whichever
// segment is actually topmost (its first nonzero bucket scanning from the
// end of MOVEMENT_BUCKET_ORDER) — every bar's true visible top is rounded,
// every segment buried under another stays square, matching the standard
// "rounded-top stacked bar" convention. 4 to match --radius-button, same
// rounding weight as the rest of the rebrand rather than an arbitrary
// chart-only value.
function topRoundedBarShape(bucket: MovementBucket) {
  return function BarShape(props: BarShapeProps) {
    const payload = props.payload as ActivityDay | undefined;
    const topVisibleBucket = payload
      ? [...MOVEMENT_BUCKET_ORDER].reverse().find((b) => (payload[b] ?? 0) > 0)
      : undefined;
    const radius: [number, number, number, number] =
      topVisibleBucket === bucket ? [4, 4, 0, 0] : [0, 0, 0, 0];
    return <Rectangle {...props} radius={radius} />;
  };
}

/**
 * Stock movement volume (not revenue) over time, grouped into the 4 buckets
 * a store owner thinks in (received/sold/transferred/adjusted — see
 * lib/movement-types.ts). One stacked bar per day — clearer at a glance
 * than 4 overlaid lines. `data` always carries the full 90-day window; the
 * range toggle just slices it client-side, so switching ranges is instant
 * and never re-fetches.
 */
export function StockActivityChart({ data }: { data: ActivityDay[] }) {
  const [range, setRange] = useState<DayRange>(30);
  const sliced = useMemo(() => data.slice(-range), [data, range]);

  return (
    <Card elevated>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Stock Activity</CardTitle>
          <CardDescription>
            Movement volume by type — received, sold, transferred, adjusted.
          </CardDescription>
        </div>
        <DayRangeToggle value={range} onChange={setRange} />
      </CardHeader>
      <CardContent className="h-72 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sliced} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={32}
              allowDecimals={false}
            />
            <Tooltip
              content={<ActivityTooltip />}
              // CORRECTED — see RevenueTooltip's identical comment
              // (revenue-chart.tsx) for why both of these are here now.
              isAnimationActive={false}
              wrapperStyle={{ transition: "none" }}
              // A custom cursor ELEMENT, not the plain {fill} object form
              // the default rectangle cursor used — that form has no way
              // to pass a corner radius, so the hover highlight was a
              // sharp-cornered box even though the bars themselves are
              // top-rounded. Same radius as the bars' own (4, matching
              // --radius-button — see topRoundedBarShape above).
              cursor={<Rectangle fill="var(--muted)" radius={[4, 4, 0, 0]} />}
            />
            <Legend
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">
                  {MOVEMENT_BUCKET_LABELS[value as MovementBucket]}
                </span>
              )}
              iconType="circle"
              iconSize={8}
            />
            {MOVEMENT_BUCKET_ORDER.map((bucket) => (
              <Bar
                key={bucket}
                dataKey={bucket}
                stackId="activity"
                fill={MOVEMENT_BUCKET_COLOR_VAR[bucket]}
                shape={topRoundedBarShape(bucket)}
                maxBarSize={28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
