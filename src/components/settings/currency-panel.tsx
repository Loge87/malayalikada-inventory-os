"use client";

import { startTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { saveOrganisationCurrency } from "@/app/(app)/settings/actions";
import { CURRENCIES, type Currency } from "@/app/(app)/products/constants";
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

/** Default currency — a compact selector shared by Retail and Wholesale,
 *  shown top-right of Price Settings. Saves as soon as a currency is
 *  picked. */
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
    } else if (state && "error" in state) {
      toastManager.add({ title: state.error, type: "error" });
    }
  }, [state, router]);

  function handleChange(value: unknown) {
    if (typeof value !== "string" || value === currency) return;
    const formData = new FormData();
    formData.set("currency", value);
    startTransition(() => formAction(formData));
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="price-settings-currency"
        className="text-sm text-muted-foreground"
      >
        Default currency
      </label>
      <Select
        name="currency"
        defaultValue={currency}
        items={CURRENCY_ITEMS}
        onValueChange={handleChange}
        disabled={pending}
      >
        <SelectTrigger id="price-settings-currency" className="w-28">
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
    </div>
  );
}
