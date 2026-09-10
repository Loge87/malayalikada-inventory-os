"use client";

import { useActionState, useState } from "react";

import { saveStockCount } from "@/app/stock-counts/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type CountItem = {
  id: string;
  label: string;
  expected: number;
  counted: number | null;
};

export function CountEntryForm({
  stockCountId,
  locationName,
  startedAt,
  items,
}: {
  stockCountId: string;
  locationName: string;
  startedAt: string;
  items: CountItem[];
}) {
  const [state, formAction, pending] = useActionState(
    saveStockCount,
    undefined
  );

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.id,
        item.counted == null ? "" : String(item.counted),
      ])
    )
  );

  const parsed = items.map((item) => {
    const raw = values[item.id] ?? "";
    const counted = raw === "" ? null : Number(raw);
    const valid = counted != null && Number.isFinite(counted);
    return {
      item,
      counted: valid ? counted : null,
      diff: valid ? counted - item.expected : null,
    };
  });

  const entered = parsed.filter((p) => p.counted != null).length;
  const discrepancies = parsed.filter(
    (p) => p.diff != null && p.diff !== 0
  ).length;

  const serialized = JSON.stringify(
    parsed.map((p) => ({
      item_id: p.item.id,
      counted_quantity: p.counted,
    }))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Counting: {locationName}</CardTitle>
        <CardDescription>
          Started {startedAt} · {entered} / {items.length} entered ·{" "}
          {discrepancies} discrepanc{discrepancies === 1 ? "y" : "ies"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="stockCountId" value={stockCountId} />
            <input type="hidden" name="counts" value={serialized} />

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Variant</th>
                    <th className="py-2 pr-4 font-medium text-right">
                      Expected
                    </th>
                    <th className="py-2 pr-4 font-medium">Counted</th>
                    <th className="py-2 font-medium text-right">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map(({ item, diff }) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="py-1.5 pr-4">{item.label}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
                        {item.expected}
                      </td>
                      <td className="py-1.5 pr-4">
                        <Input
                          type="number"
                          step="1"
                          inputMode="numeric"
                          aria-label={`Counted quantity for ${item.label}`}
                          className="h-7 w-24"
                          value={values[item.id] ?? ""}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {diff == null || diff === 0 ? (
                          <span className="text-muted-foreground">–</span>
                        ) : (
                          <span
                            className={
                              diff > 0 ? "text-foreground" : "text-destructive"
                            }
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {state && "error" in state ? (
              <FieldError>{state.error}</FieldError>
            ) : null}

            <div className="flex gap-2">
              <Button
                type="submit"
                name="intent"
                value="save"
                variant="outline"
                size="sm"
                disabled={pending}
              >
                {pending ? "Saving…" : "Save progress"}
              </Button>
              <Button
                type="submit"
                name="intent"
                value="complete"
                size="sm"
                disabled={pending}
              >
                {pending ? "Working…" : "Complete count"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              No variants are held at this location — nothing to count.
            </p>
            <form action={formAction}>
              <input type="hidden" name="stockCountId" value={stockCountId} />
              <input type="hidden" name="counts" value="[]" />
              <Button
                type="submit"
                name="intent"
                value="complete"
                size="sm"
                disabled={pending}
              >
                Close count
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
