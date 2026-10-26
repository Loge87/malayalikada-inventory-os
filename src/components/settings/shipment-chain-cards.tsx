"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

import { setShipmentApplies } from "@/app/(app)/settings/shipment-cost-actions";
import { OPERATOR_COLOR_CLASS, type FormulaType, type ShipmentCosts } from "@/lib/price-formula";
import { PRODUCT_TYPES, PRODUCT_TYPE_LABELS, type ProductType } from "@/lib/product-type";
import { cn } from "@/lib/utils";
import { toastManager } from "@/components/ui/toast";

function valueLabel(cost: ShipmentCosts[ProductType]) {
  if (!cost) return "0";
  return cost.valueType === "percentage" ? `${cost.value}%` : String(cost.value);
}

/**
 * Shipment cost cards, shown under the formula chain. They are added to the
 * price automatically (by product type, after the chain's own steps) and can
 * be removed from this formula, or added back.
 */
export function ShipmentChainCards({
  formulaType,
  costs,
}: {
  formulaType: FormulaType;
  costs: ShipmentCosts;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Partial<Record<ProductType, boolean>>>({});
  const label = formulaType === "retail" ? "Retail" : "Wholesale";

  const enabled = (type: ProductType) => overrides[type] ?? costs[type]?.[formulaType] ?? true;

  function toggle(type: ProductType, next: boolean) {
    setOverrides((o) => ({ ...o, [type]: next }));
    startTransition(async () => {
      const result = await setShipmentApplies(formulaType, type, next);
      if (result && "error" in result) {
        setOverrides((o) => ({ ...o, [type]: !next }));
        toastManager.add({ title: result.error, type: "error" });
        return;
      }
      router.refresh();
      toastManager.add({
        title: `${PRODUCT_TYPE_LABELS[type]} shipment ${next ? "added to" : "removed from"} the ${label} price`,
        type: "success",
      });
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      <div>
        <h3 className="text-sm font-medium">Shipment cost</h3>
        <p className="text-caption">
          Added automatically by product type, after the steps above. Remove one to leave it out of the {label} price.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PRODUCT_TYPES.map((type) =>
          enabled(type) ? (
            <div
              key={type}
              className="flex items-center gap-2 rounded-lg border bg-card py-1.5 pl-1.5 pr-2 text-sm shadow-xs"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-6 place-items-center rounded-full border-2 text-xs font-semibold",
                  OPERATOR_COLOR_CLASS.add
                )}
              >
                +
              </span>
              <span className="font-medium">{PRODUCT_TYPE_LABELS[type]} shipment</span>
              <span className="font-mono text-muted-foreground">{valueLabel(costs[type])}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(type, false)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${PRODUCT_TYPE_LABELS[type]} shipment from the ${label} price`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              key={type}
              type="button"
              disabled={pending}
              onClick={() => toggle(type, true)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-sm text-muted-foreground hover:border-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" />
              {PRODUCT_TYPE_LABELS[type]} shipment
            </button>
          )
        )}
      </div>
    </div>
  );
}
