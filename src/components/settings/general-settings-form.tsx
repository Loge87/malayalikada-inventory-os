"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { saveOrganisationCurrency } from "@/app/(app)/settings/actions";
import { CURRENCIES, type Currency } from "@/app/(app)/products/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastManager } from "@/components/ui/toast";

const CURRENCY_ITEMS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c, c])
);

/** The only organisation-wide setting today — a natural home for more, later,
 *  as they come up. Currency used to live inside the old Price Settings form
 *  (it isn't really a pricing-formula concept); split out here now that that
 *  form is gone. */
export function GeneralSettingsForm({ currency }: { currency: Currency }) {
  const [state, formAction, pending] = useActionState(
    saveOrganisationCurrency,
    undefined
  );
  const router = useRouter();

  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      toastManager.add({ title: "Settings saved", type: "success" });
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel htmlFor="general-settings-currency">
              Default currency
            </FieldLabel>
            <Select
              name="currency"
              defaultValue={currency}
              items={CURRENCY_ITEMS}
            >
              <SelectTrigger id="general-settings-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
