/**
 * The fixed set of value types a price_variable can be — pulled out of
 * price-variable-actions.ts (a "use server" file) into its own plain
 * module. A "use server" file may only export async functions for a client
 * component to consume; a plain value export like this array gets silently
 * mangled by the bundler instead (not a build-time error), which is exactly
 * what broke PriceVariablesPanel's type <Select> — `PRICE_VARIABLE_TYPES`
 * resolved to something that wasn't an array at all on the client.
 *
 * Also the shared home for the PriceVariable shape itself and how its value
 * displays — both the right-panel list (price-variables-panel.tsx) and the
 * chain builder's variable boxes (price-formula-chain.tsx) need the exact
 * same "CGST — 12%" formatting, so it lives here once rather than in
 * whichever component happened to need it first.
 */
import { formatMoney } from "@/lib/format";

export const PRICE_VARIABLE_TYPES = ["number", "percentage", "currency"] as const;
export type PriceVariableType = (typeof PRICE_VARIABLE_TYPES)[number];

export type PriceVariable = {
  id: string;
  name: string;
  value: number;
  valueType: PriceVariableType;
};

/** How a variable's raw numeric value reads — "9%" for a percentage, a
 *  formatted amount for a currency, the bare number otherwise. Purely a
 *  display concern; the Stage C evaluator always works off the raw
 *  `value` + `valueType`, never this string. */
export function formatVariableValue(
  variable: PriceVariable,
  currency: string
): string {
  switch (variable.valueType) {
    case "percentage":
      return `${variable.value}%`;
    case "currency":
      return formatMoney(variable.value, currency);
    case "number":
      return String(variable.value);
  }
}
