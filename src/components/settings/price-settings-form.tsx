"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { savePriceSettings } from "@/app/(app)/settings/actions";
import { CURRENCIES, type Currency } from "@/app/(app)/products/constants";
import type { PriceSettingsRates } from "@/lib/price-calculation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastManager } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type PriceSettings = {
  currency: Currency;
  retail: PriceSettingsRates;
  wholesale: PriceSettingsRates;
  wholesaleUsesSameAsRetail: boolean;
};

/** [field name suffix, label] — the same five rates, in the same order, for
 * both cards; the actual form field name is "retail" + suffix or
 * "wholesale" + suffix (see RateFieldsGrid below), matching
 * settings/actions.ts's parseRateSet(). */
const RATE_FIELDS: { suffix: string; label: string }[] = [
  { suffix: "CgstPercent", label: "CGST (%)" },
  { suffix: "SgstPercent", label: "SGST (%)" },
  { suffix: "ProfitMarginPercent", label: "Profit margin (%)" },
  { suffix: "LogisticsChargesPercent", label: "Logistics charges (%)" },
  { suffix: "AdditionalChargesPercent", label: "Additional charges (%)" },
];

const CURRENCY_ITEMS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c, c])
);

function rateFieldValue(rates: PriceSettingsRates, suffix: string): number {
  const key = (suffix.charAt(0).toLowerCase() + suffix.slice(1)) as keyof PriceSettingsRates;
  return rates[key];
}

/**
 * The five rate inputs, prefixed "retail" or "wholesale" in both id and
 * form field name.
 *
 * `displayRates` is what's shown — for the wholesale grid while "use same
 * as retail" is checked, that's retail's values (mirrored), not
 * wholesale's own. `submit={false}` drops the `name` attribute so a
 * mirrored, read-only field never actually submits retail's value under a
 * wholesale_* column: PriceSettingsForm renders separate hidden inputs
 * carrying wholesale's real stored values in that case, so a save while
 * checked can't clobber them. `readOnly` (not `disabled`) blocks editing
 * without excluding an actually-submitting field from FormData the way
 * `disabled` would.
 */
function RateFieldsGrid({
  prefix,
  displayRates,
  readOnly = false,
  submit = true,
}: {
  prefix: "retail" | "wholesale";
  displayRates: PriceSettingsRates;
  readOnly?: boolean;
  submit?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {RATE_FIELDS.map(({ suffix, label }) => {
        const name = `${prefix}${suffix}`;
        return (
          <Field key={name}>
            <FieldLabel htmlFor={`price-settings-${name}`}>{label}</FieldLabel>
            <Input
              id={`price-settings-${name}`}
              name={submit ? name : undefined}
              type="number"
              step="0.01"
              min="0"
              defaultValue={rateFieldValue(displayRates, suffix)}
              readOnly={readOnly}
            />
          </Field>
        );
      })}
    </div>
  );
}

export function PriceSettingsForm({ settings }: { settings: PriceSettings }) {
  const [state, formAction, pending] = useActionState(
    savePriceSettings,
    undefined
  );
  const router = useRouter();
  const [useSameAsRetail, setUseSameAsRetail] = useState(
    settings.wholesaleUsesSameAsRetail
  );

  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      toastManager.add({ title: "Price settings saved", type: "success" });
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Retail Price Settings</CardTitle>
          <CardDescription>
            Applied to unit price — selling one at a time. Also sets the
            organisation&apos;s default currency for new products/variants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="price-settings-currency">Currency</FieldLabel>
              <Select
                name="currency"
                defaultValue={settings.currency}
                items={CURRENCY_ITEMS}
              >
                <SelectTrigger id="price-settings-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <RateFieldsGrid prefix="retail" displayRates={settings.retail} />
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wholesale Price Settings</CardTitle>
          <CardDescription>
            Applied to pack/box price — selling by the case.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={useSameAsRetail}
                onCheckedChange={(checked) => setUseSameAsRetail(checked === true)}
              />
              Use same as retail
            </label>
            {/* A real, always-submitted checkbox input — kept separate from
                the Checkbox component above (which is Base UI's own
                controlled primitive, not guaranteed to expose a native
                input with this exact name) so the "on"/absent submission
                contract savePriceSettings() relies on is never in doubt. */}
            <input
              type="checkbox"
              name="wholesaleUsesSameAsRetail"
              checked={useSameAsRetail}
              onChange={() => {}}
              className="hidden"
              aria-hidden
            />

            <div
              className={cn(
                "flex flex-col gap-4 transition-opacity",
                useSameAsRetail && "opacity-50"
              )}
            >
              {useSameAsRetail ? (
                <p className="text-xs text-muted-foreground">
                  Showing Retail Price Settings&apos; values — this is what
                  Wholesale Price will use while checked. Uncheck to enter
                  wholesale&apos;s own values again; they&apos;re kept
                  underneath, unchanged, the whole time.
                </p>
              ) : null}
              {/* key forces a remount whenever the displayed rate set
                  changes — toggling the checkbox, or retail's own values
                  changing on a later save/refresh while still checked —
                  since an uncontrolled input's defaultValue is only read
                  once, on mount, and is otherwise ignored on re-render. */}
              <RateFieldsGrid
                key={JSON.stringify(
                  useSameAsRetail ? settings.retail : settings.wholesale
                )}
                prefix="wholesale"
                displayRates={useSameAsRetail ? settings.retail : settings.wholesale}
                readOnly={useSameAsRetail}
                submit={!useSameAsRetail}
              />
            </div>
            {useSameAsRetail
              ? RATE_FIELDS.map(({ suffix }) => (
                  // Wholesale's own rates still ride along in the submit,
                  // untouched, even while the visible fields above are
                  // showing (and would otherwise submit) retail's mirrored
                  // values instead — see RateFieldsGrid's `submit` prop.
                  <input
                    key={suffix}
                    type="hidden"
                    name={`wholesale${suffix}`}
                    value={rateFieldValue(settings.wholesale, suffix)}
                  />
                ))
              : null}
          </FieldGroup>
        </CardContent>
      </Card>

      {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
