/**
 * NZD→USD exchange rate for the dashboard's "USD" column (Stock by
 * Location table, financials:view only). Frankfurter (ECB-based, free, no
 * API key) via Next.js's Data Cache — `next: { revalidate: 3600 }` means
 * this fetch is reused across EVERY request/user for up to an hour, not
 * refetched per page load. That's a different mechanism from
 * lib/supabase/get-current-user.ts's React `cache()`, which only dedupes
 * within a single request and would still hit the network once per
 * navigation; Next's Data Cache is what actually keeps this off the
 * request path, which matters given today's dashboard performance pass
 * (see "Cut redundant auth calls and a duplicate query").
 *
 * Returns null on any failure (network error, non-2xx, unexpected body) —
 * never throws, so a flaky external rate source can't crash or block the
 * rest of the dashboard. Callers show "Rate unavailable" for null.
 */
export async function getNzdToUsdRate(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=NZD&to=USD",
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const rate = data?.rates?.USD;
    return typeof rate === "number" ? rate : null;
  } catch {
    return null;
  }
}
