import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import {
  PurchaseOrderForm,
  type LocationOption,
  type VariantOption,
} from "@/components/purchase-orders/purchase-order-form";
import { ReceiveForm } from "@/components/purchase-orders/receive-form";
import type { PurchaseOrderStatus } from "@/app/(app)/purchase-orders/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type VariantRow = {
  id: string;
  name: string;
  sku: string;
  products: { name: string } | null;
};

type PurchaseOrderRow = {
  id: string;
  supplier_name: string;
  status: PurchaseOrderStatus;
  received_at: string | null;
  created_at: string;
  locations: { name: string } | null;
  purchase_order_items: {
    id: string;
    quantity_ordered: number;
    product_variants:
      | { name: string; sku: string; products: { name: string } | null }
      | null;
  }[];
};

function itemLabel(
  variant: { name: string; products: { name: string } | null } | null
): string {
  if (!variant) return "Unknown variant";
  return variant.products?.name
    ? `${variant.products.name} — ${variant.name}`
    : variant.name;
}

function variantLabel(name: string, sku: string, productName?: string) {
  const base = productName ? `${productName} — ${name}` : name;
  return `${base} (${sku})`;
}

export default async function PurchaseOrdersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // All reads are RLS-scoped to the caller's organisation.
  const [locationsRes, variantsRes, purchaseOrdersRes] = await Promise.all([
    supabase
      .from("locations")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("product_variants")
      .select("id, name, sku, products(name)")
      .order("name")
      .returns<VariantRow[]>(),
    supabase
      .from("purchase_orders")
      .select(
        `id, supplier_name, status, received_at, created_at,
         locations(name),
         purchase_order_items(
           id,
           quantity_ordered,
           product_variants(name, sku, products(name))
         )`
      )
      .order("created_at", { ascending: false })
      .returns<PurchaseOrderRow[]>(),
  ]);

  const firstError =
    locationsRes.error || variantsRes.error || purchaseOrdersRes.error;
  if (firstError) {
    throw firstError;
  }

  const locations: LocationOption[] = (locationsRes.data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
  }));

  const variants: VariantOption[] = (variantsRes.data ?? []).map((v) => ({
    id: v.id,
    label: variantLabel(v.name, v.sku, v.products?.name),
  }));

  const purchaseOrders = purchaseOrdersRes.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-5 sm:gap-8 sm:p-8 md:p-12">
      <div>
        <h1 className="text-page-title">Purchase Orders</h1>
        <p className="text-page-subtitle">
          Receive stock from suppliers into a location.
        </p>
      </div>

      <PurchaseOrderForm locations={locations} variants={variants} />

      <Card>
        <CardHeader>
          <CardTitle>Purchase orders</CardTitle>
          <CardDescription>
            {purchaseOrders.length > 0
              ? `${purchaseOrders.length} total`
              : "None yet"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {purchaseOrders.length > 0 ? (
            purchaseOrders.map((po) => (
              <div
                key={po.id}
                className="flex flex-col gap-2 rounded-lg ring-1 ring-foreground/10 p-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="block truncate font-medium">
                      {po.supplier_name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      To {po.locations?.name ?? "Unknown location"} ·{" "}
                      {formatDate(po.created_at)}
                    </span>
                  </div>
                  <span
                    className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium capitalize"
                    data-status={po.status}
                  >
                    {po.status}
                  </span>
                </div>

                <ul className="divide-y divide-border border-y border-border">
                  {po.purchase_order_items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-4 py-1.5 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {itemLabel(item.product_variants)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {item.quantity_ordered}
                      </span>
                    </li>
                  ))}
                </ul>

                {po.status === "draft" ? (
                  <ReceiveForm
                    purchaseOrderId={po.id}
                    items={po.purchase_order_items.map((item) => ({
                      id: item.id,
                      label: itemLabel(item.product_variants),
                    }))}
                  />
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Received
                    {po.received_at ? ` ${formatDateTime(po.received_at)}` : ""}
                  </span>
                )}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No purchase orders yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
