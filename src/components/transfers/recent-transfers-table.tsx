"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { formatDateTime } from "@/lib/format";
import { TablePagination } from "@/components/dashboard/table-pagination";

export type Transfer = {
  referenceId: string;
  createdAt: string;
  quantity: number;
  variantLabel: string;
  source: string | null;
  destination: string | null;
};

/**
 * CORRECTED this pass (items 9/10): was a plain <ul> of rows directly on
 * the server page — now a compact, fixed-column table (matching Teams/
 * Clients) with SERVER-side pagination (the page fetches one 10-row
 * window via Supabase `.range()`, not the full history — see the page's
 * own comment on why a transfer's two paired movement rows make that
 * windowing slightly less trivial than a plain row count).
 *
 * Pagination is still the shared TablePagination component /products
 * uses — this is a thin client wrapper around it so a page click updates
 * the URL's own `?page=` (via router.push), which re-runs the Server
 * Component page with the new searchParams and fetches that page's rows —
 * URL-persisted state, consistent with how /products and /stock-out's
 * History tab already read their own query params (see stock-out-
 * history.tsx), rather than a client-side slice of an already-fetched
 * array the way /products' own usePagination works today.
 */
export function RecentTransfersTable({
  transfers,
  page,
  totalPages,
}: {
  transfers: Transfer[];
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(next));
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div>
      {transfers.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="table table-fixed">
              <colgroup>
                <col style={{ width: "var(--transfer-col-variant)" }} />
                <col style={{ width: "var(--transfer-col-source)" }} />
                <col style={{ width: "var(--transfer-col-destination)" }} />
                <col style={{ width: "var(--transfer-col-qty)" }} />
                <col style={{ width: "var(--transfer-col-date)" }} />
              </colgroup>
              <thead>
                <tr className="table-head">
                  <th className="font-medium">Variant</th>
                  <th className="font-medium">Source</th>
                  <th className="font-medium">Destination</th>
                  <th className="cell-number pr-2 font-medium">Qty</th>
                  <th className="font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((transfer) => (
                  <tr
                    key={transfer.referenceId}
                    className="table-row"
                    style={{ height: "var(--space-table-row-height)" }}
                  >
                    <td className="truncate py-2 pr-2" title={transfer.variantLabel}>
                      {transfer.variantLabel}
                    </td>
                    <td className="truncate py-2 pr-2 text-muted-foreground">
                      {transfer.source ?? "?"}
                    </td>
                    <td className="truncate py-2 pr-2 text-muted-foreground">
                      {transfer.destination ?? "?"}
                    </td>
                    <td className="cell-number py-2 pr-2 font-medium tabular-nums">
                      {transfer.quantity}
                    </td>
                    <td className="truncate py-2 text-xs text-muted-foreground">
                      {formatDateTime(transfer.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination page={page} totalPages={totalPages} onChange={goToPage} />
        </>
      ) : (
        <p className="text-muted-foreground">No transfers yet</p>
      )}
    </div>
  );
}
