"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney, formatShortDate } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DayRangeToggle, type DayRange } from "@/components/dashboard/day-range-toggle";

export type RevenueDay = { date: string; amounts: Record<string, number> };

const SERIES_COLOR_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];

type TooltipEntry = { dataKey: string; value: number; color: string };

function RevenueTooltip({
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
              {entry.dataKey}
            </span>
            <span className="font-medium tabular-nums">
              {formatMoney(entry.value, entry.dataKey)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Estimated revenue — sum of SALE movement quantity × unit_price, per day,
 * grouped by currency (never converted/combined across currencies). Labeled
 * "estimated" throughout because it's derived from the ledger, not a real
 * accounting/tax figure — this app has no checkout, discounts, or refund
 * netting to draw a true revenue number from (see CLAUDE.md).
 */
export function RevenueChart({
  data,
  currencies,
}: {
  data: RevenueDay[];
  currencies: string[];
}) {
  const [range, setRange] = useState<DayRange>(30);
  const sliced = useMemo(
    () => data.slice(-range).map((day) => ({ date: day.date, ...day.amounts })),
    [data, range]
  );

  return (
    <Card elevated>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Estimated Revenue (from POS sales)</CardTitle>
          <CardDescription>
            SALE movement quantity × unit price — derived from the ledger,
            not a full accounting figure.
          </CardDescription>
        </div>
        {currencies.length > 0 ? (
          <DayRangeToggle value={range} onChange={setRange} />
        ) : null}
      </CardHeader>
      <CardContent className="h-72 px-2">
        {currencies.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No priced sales recorded yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sliced} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                width={48}
              />
              <Tooltip content={<RevenueTooltip />} />
              {currencies.length > 1 ? (
                <Legend iconType="circle" iconSize={8} />
              ) : null}
              {currencies.map((currency, i) => (
                <Area
                  key={currency}
                  type="monotone"
                  dataKey={currency}
                  name={currency}
                  stroke={SERIES_COLOR_VARS[i % SERIES_COLOR_VARS.length]}
                  fill={SERIES_COLOR_VARS[i % SERIES_COLOR_VARS.length]}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
