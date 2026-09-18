"use client";

import { useMemo, useState } from "react";

export const DASHBOARD_TABLE_PAGE_SIZE = 10;

/**
 * Client-side pagination for a dashboard table — slices `items` into pages
 * of `pageSize` (default 10, per the dashboard's "cap at 10 rows, paginate
 * beyond that" rule) so the table's container height is always just the
 * current page's row count, never a fixed 10-row box padded with empty
 * space. Resets to page 1 whenever the (already-filtered) item count
 * shrinks below the current page's start — e.g. after a filter changes.
 */
export function usePagination<T>(
  items: T[],
  pageSize: number = DASHBOARD_TABLE_PAGE_SIZE
) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  function setPageClamped(next: number) {
    setPage(Math.max(1, Math.min(next, totalPages)));
  }

  // Callers should invoke this when a filter/search value changes, so
  // changing the filter always lands on page 1 rather than an arbitrary
  // (possibly now out-of-range) page from before the filter changed.
  function resetPage() {
    setPage(1);
  }

  return {
    pageItems,
    page: safePage,
    totalPages,
    setPage: setPageClamped,
    resetPage,
  };
}
