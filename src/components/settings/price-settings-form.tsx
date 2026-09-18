"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { savePriceSettings } from "@/app/(app)/settings/actions";
import { CURRENCIES, type Currency } from "@/app/(app)/products/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export type PriceSettings = {
  currency: Currency;
  cgstPercent: number;
  sgstPercent: number;
  profitMarginPercent: number;
  logisticsChargesPercent: number;
  additionalChargesPercent: number;
};

/** name, label — in the exact order the percent fields must appear, top to
 *  bottom / left to right in the 2-column grid below. Currency isn't in this
 *  list — it's a Select, not a numeric Input, and always renders first. */
const PERCENT_FIELDS: { name: keyof PriceSettings; label: string }[] = [
  { name: "cgstPercent", label: "CGST (%)" },
  { name: "sgstPercent", label: "SGST (%)" },
  { name: "profitMarginPercent", label: "Profit margin (%)" },
  { name: "logisticsChargesPercent", label: "Logistics charges (%)" },
  { name: "additionalChargesPercent", label: "Additional charges (%)" },
];

const CURRENCY_ITEMS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c, c])
);

export function PriceSettingsForm({ settings }: { settings: PriceSettings }) {
  const [state, formAction, pending] = useActionState(
    savePriceSettings,
    undefined
  );
  const router = useRouter();

  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      toastManager.add({ title: "Price settings saved", type: "success" });
    }
  }, [state, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Settings</CardTitle>
        <CardDescription>
          Not used in retail/wholesale price calculations yet — this just
          captures the values for now.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="price-settings-currency">
                  Currency
                </FieldLabel>
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
              {PERCENT_FIELDS.map(({ name, label }) => (
                <Field key={name}>
                  <FieldLabel htmlFor={`price-settings-${name}`}>
                    {label}
                  </FieldLabel>
                  <Input
                    id={`price-settings-${name}`}
                    name={name}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={settings[name]}
                  />
                </Field>
              ))}
            </div>

            {state && "error" in state ? (
              <FieldError>{state.error}</FieldError>
            ) : null}

            <Button type="submit" disabled={pending} className="w-fit">
              {pending ? "Saving…" : "Save"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
