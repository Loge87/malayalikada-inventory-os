"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
    <div className="rounded-lg bg-popover p-2.5 text-xs shadow-md ring-1 ring-foreground/10">
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
            <Tooltip content={<ActivityTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Legend
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">
                  {MOVEMENT_BUCKET_LABELS[value as MovementBucket]}
                </span>
              )}
              iconType="circle"
              iconSize={8}
            />
            {MOVEMENT_BUCKET_ORDER.map((bucket, i) => (
              <Bar
                key={bucket}
                dataKey={bucket}
                stackId="activity"
                fill={MOVEMENT_BUCKET_COLOR_VAR[bucket]}
                radius={
                  i === MOVEMENT_BUCKET_ORDER.length - 1
                    ? [3, 3, 0, 0]
                    : undefined
                }
                maxBarSize={28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
