"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { reactivateProduct } from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";

/**
 * The "reactivate instead of creating a duplicate" action — shown by every
 * duplicate-check UI (BarcodeDuplicateField, AddProductMenu, NewProductForm)
 * when a scanned/typed barcode matches a soft-deleted product, so the
 * interaction is identical everywhere it appears rather than three separate
 * implementations. Not a <form> — reactivateProduct is a plain callable
 * action, same convention as checkBarcodeExists.
 */
export function ReactivateProductButton({
  productId,
  productName,
  onReactivated,
}: {
  productId: string;
  productName: string;
  /** Called right before navigating away — e.g. closing a dialog this
   *  button is inside of. */
  onReactivated?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleReactivate() {
    setPending(true);
    setError(null);
    const result = await reactivateProduct(productId);
    setPending(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    toastManager.add({ title: `${productName} reactivated`, type: "success" });
    onReactivated?.();
    router.push(`/products/${productId}/edit`);
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleReactivate}
        disabled={pending}
      >
        {pending ? "Reactivating…" : "Reactivate product"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
