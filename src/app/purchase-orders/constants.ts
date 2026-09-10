export const PURCHASE_ORDER_STATUSES = ["draft", "received"] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export type PurchaseOrderFormState = { error: string } | { ok: true } | undefined;
