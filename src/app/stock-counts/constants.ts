export const STOCK_COUNT_STATUSES = ["in_progress", "completed"] as const;
export type StockCountStatus = (typeof STOCK_COUNT_STATUSES)[number];

export type StockCountFormState = { error: string } | { ok: true } | undefined;
