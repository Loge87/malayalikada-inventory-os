// Only these two movement types are exposed in the UI for now. The ledger
// function (`record_inventory_movement`) supports the full set:
// PURCHASE_RECEIVED, SALE, TRANSFER_OUT, TRANSFER_IN, DAMAGE, EXPIRY,
// ADJUSTMENT, RETURN.
export const MOVEMENT_TYPES = ["PURCHASE_RECEIVED", "ADJUSTMENT"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  PURCHASE_RECEIVED: "Purchase received",
  ADJUSTMENT: "Adjustment",
};

export type MovementFormState = { error: string } | { ok: true } | undefined;
