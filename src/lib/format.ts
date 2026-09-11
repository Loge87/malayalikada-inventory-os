// Fixed locale + timezone so a timestamp formats identically on the server and
// in the browser — otherwise server-rendered dates disagree with the client and
// trigger hydration mismatches.
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export function formatDate(value: string | Date): string {
  return DATE.format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return `${DATE_TIME.format(new Date(value))} UTC`;
}

/** Whole days from today until `value` (UTC-based); negative when already past. */
export function daysUntil(value: string | Date): number {
  const target = new Date(value);
  const now = new Date();
  const targetUtc = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate()
  );
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return Math.round((targetUtc - todayUtc) / 86_400_000);
}

/** Formats a price with its currency; falls back to "<currency> <amount>" for
 *  a currency code Intl doesn't recognize instead of throwing. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(
      amount
    );
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
