export type OrderStatus = "submitted" | "approved" | "picked" | "dispatched" | "delivered" | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  submitted: "New",
  approved: "Approved",
  picked: "Picked",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  submitted: "bg-status-warning/10 text-status-warning",
  approved: "bg-primary/10 text-primary",
  picked: "bg-primary/10 text-primary",
  dispatched: "bg-primary/10 text-primary",
  delivered: "bg-status-success/10 text-status-success",
  cancelled: "bg-muted text-muted-foreground",
};

export const ORDER_FILTERS: { value: "open" | "all" | OrderStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "submitted", label: "New" },
  { value: "approved", label: "Approved" },
  { value: "picked", label: "Picked" },
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];
