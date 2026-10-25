"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { saveOrganisationCurrency } from "@/app/(app)/settings/actions";
import { CURRENCIES, type Currency } from "@/app/(app)/products/constants";
import { Button } from "@/components/ui/button";
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

/** Default currency — moved here from the General tab; sits above the
 *  Variables section in Price Settings' right-hand panel. */
export function CurrencyPanel({ currency }: { currency: Currency }) {
  const [state, formAction, pending] = useActionState(
    saveOrganisationCurrency,
    undefined
  );
  const router = useRouter();

  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      toastManager.add({ title: "Currency saved", type: "success" });
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <h2 className="text-section-title">Currency</h2>
        <p className="text-caption">Used for every price in the app.</p>
      </div>
      <Field>
        <FieldLabel htmlFor="price-settings-currency">Default currency</FieldLabel>
        <Select name="currency" defaultValue={currency} items={CURRENCY_ITEMS}>
          <SelectTrigger id="price-settings-currency" className="w-full">
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
      {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}
      <Button type="submit" size="sm" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save currency"}
      </Button>
    </form>
  );
}
