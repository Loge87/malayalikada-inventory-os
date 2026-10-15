"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  saveWholesaleSettings,
  setVariantsPortalVisible,
} from "@/app/(app)/settings/wholesale-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { toastManager } from "@/components/ui/toast";

export type WholesaleSettingsValues = {
  isEnabled: boolean;
  minOrderValue: number;
  fulfilmentLocationIds: string[];
  stockBasis: "unit" | "case";
  notifyEmail: string;
  guestMessage: string;
};

export type PortalVariant = {
  id: string;
  label: string;
  sku: string;
  unitsPerPack: number;
  visible: boolean;
};

export function WholesaleSettings({
  currency,
  values,
  locations,
  variants,
}: {
  currency: string;
  values: WholesaleSettingsValues;
  locations: { id: string; label: string }[];
  variants: PortalVariant[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveWholesaleSettings, undefined);
  const [locationIds, setLocationIds] = useState<string[]>(values.fulfilmentLocationIds);
  const [query, setQuery] = useState("");
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      toastManager.add({ title: "Wholesale settings saved", type: "success" });
    }
  }, [state, router]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? variants.filter((v) => v.label.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q))
      : variants;
  }, [variants, query]);
  const visibleCount = variants.filter((v) => v.visible).length;

  function setVisible(ids: string[], visible: boolean) {
    startTransition(async () => {
      const res = await setVariantsPortalVisible(ids, visible);
      if ("error" in res) {
        toastManager.add({ title: res.error, type: "error" });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-6">
        {locationIds.map((id) => (
          <input key={id} type="hidden" name="locationIds" value={id} />
        ))}
        <Card>
          <CardHeader>
            <CardTitle>Ordering rules</CardTitle>
            <CardDescription>
              How retailers order in the wholesale portal. One unit in the portal is one
              case or pack.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isEnabled" defaultChecked={values.isEnabled} />
              Accept portal orders
            </label>
            <Field>
              <FieldLabel htmlFor="ws-min">Minimum order value ({currency})</FieldLabel>
              <Input
                id="ws-min"
                name="minOrderValue"
                type="number"
                min={0}
                step="0.01"
                defaultValue={values.minOrderValue}
                required
              />
            </Field>
            <Field>
              <FieldLabel>Fulfil orders from</FieldLabel>
              <MultiSelect
                idPrefix="ws-locations"
                options={locations}
                selectedIds={locationIds}
                onToggle={(id, checked) =>
                  setLocationIds((cur) =>
                    checked ? [...cur, id] : cur.filter((x) => x !== id)
                  )
                }
                placeholder="All warehouses (default)"
              />
              <p className="text-sm text-muted-foreground">
                Stock is checked and reserved at these locations, first listed first. Leave
                empty to use your warehouses.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="ws-basis">Stock is counted in</FieldLabel>
              <select
                id="ws-basis"
                name="stockBasis"
                defaultValue={values.stockBasis}
                className="select w-full"
              >
                <option value="unit">Single units (a case uses its units per pack)</option>
                <option value="case">Cases / packs</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="ws-email">Send new-order alerts to</FieldLabel>
              <Input
                id="ws-email"
                name="notifyEmail"
                type="email"
                defaultValue={values.notifyEmail}
                placeholder="orders@yourbusiness.com"
              />
              <p className="text-sm text-muted-foreground">
                Emails are queued now and start sending once email delivery is set up.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="ws-guest">Message shown to visitors who are not signed in</FieldLabel>
              <Input id="ws-guest" name="guestMessage" defaultValue={values.guestMessage} />
            </Field>
            {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}
            <Button type="submit" disabled={pending} className="w-fit">
              {pending ? "Saving…" : "Save"}
            </Button>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Products in the portal</CardTitle>
          <CardDescription>
            {visibleCount} of {variants.length} products are visible to retailers. Case size
            comes from each product&apos;s units per pack.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products or SKU"
              className="sm:w-72"
            />
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setVisible(shown.filter((v) => !v.visible).map((v) => v.id), true)}
            >
              Show {query ? "matching" : "all"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setVisible(shown.filter((v) => v.visible).map((v) => v.id), false)}
            >
              Hide {query ? "matching" : "all"}
            </Button>
          </div>
          {shown.length === 0 ? (
            <p className="text-muted-foreground">No products found.</p>
          ) : (
            <ul className="divide-y">
              {shown.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{v.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {v.sku} · {v.unitsPerPack} per case
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={v.visible}
                      disabled={busy}
                      onChange={(e) => setVisible([v.id], e.target.checked)}
                    />
                    In portal
                  </label>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
