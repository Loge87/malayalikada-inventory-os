"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteProduct,
  updateProduct,
  updateVariant,
} from "@/app/(app)/products/actions";
import { VARIANT_UNITS, type Currency } from "@/app/(app)/products/constants";
import { formatMoney } from "@/lib/format";
import { applyPriceSettings, resolveWholesaleRates } from "@/lib/price-calculation";
import type { OrganisationPriceSettings } from "@/lib/organisation";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { usePermissions } from "@/components/providers/role-provider";
import { ProductImageField } from "@/components/products/product-image-field";
import { VariantForm } from "@/components/products/variant-form";
import {
  ReadOnlyCurrencyField,
  VariantPricingFields,
} from "@/components/products/variant-pricing-fields";
import { toastManager } from "@/components/ui/toast";
import type {
  EditableProduct,
  EditableVariant,
} from "@/components/products/products-table";
import type { LocationOption } from "@/components/products/variant-extra-fields";

const UNIT_ITEMS: Record<string, string> = Object.fromEntries(
  VARIANT_UNITS.map((unit) => [unit, unit])
);

function ProductFieldsForm({ product }: { product: EditableProduct }) {
  const [state, formAction, pending] = useActionState(updateProduct, undefined);
  const idPrefix = `edit-product-${product.id}`;
  const router = useRouter();

  // revalidatePath() (in the server action) only invalidates the cache for
  // the *next* request to /products — it doesn't push anything to a tree
  // that's already mounted, like this panel's own list is. router.refresh()
  // is the client-side half: it re-runs the current route's Server
  // Components against that now-invalidated cache, so the list actually
  // reflects the edit without a full navigation.
  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="productId" value={product.id} />
      <FieldGroup>
        <ProductImageField idPrefix={idPrefix} initialPreviewUrl={product.imageUrl} />

        <Field>
          <FieldLabel htmlFor={`${idPrefix}-name`}>Product name</FieldLabel>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            defaultValue={product.name}
            required
          />
        </Field>
        <Field orientation="responsive">
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-category`}>Category</FieldLabel>
            <Input
              id={`${idPrefix}-category`}
              name="category"
              defaultValue={product.category}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-brand`}>Brand</FieldLabel>
            <Input
              id={`${idPrefix}-brand`}
              name="brand"
              defaultValue={product.brand ?? ""}
              placeholder="Optional"
            />
          </Field>
        </Field>

        {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}

        <Button type="submit" size="sm" disabled={pending} className="w-fit">
          {pending ? "Saving…" : "Save product"}
        </Button>
      </FieldGroup>
    </form>
  );
}

function CalculatedPrices({
  variant,
  priceSettings,
}: {
  variant: EditableVariant;
  priceSettings: OrganisationPriceSettings | null;
}) {
  if (!priceSettings) {
    return (
      <p className="rounded-md bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
        <Link href="/settings" className="font-medium underline">
          Set price settings
        </Link>{" "}
        to calculate retail and wholesale price.
      </p>
    );
  }

  // Retail applies its own Price Settings rates to unit_price (selling one
  // at a time). Wholesale applies its own rates to pack_price (selling by
  // the case) — unless "use same as retail" is checked, in which case
  // resolveWholesaleRates() picks retail's rates instead, live. pack_price
  // itself stays a plain editable input above, not run through either
  // multiplier — see VariantPricingFields.
  const retailPrice = applyPriceSettings(variant.unitPrice, priceSettings.retail);
  const wholesalePrice = applyPriceSettings(
    variant.packPrice,
    resolveWholesaleRates(
      priceSettings.retail,
      priceSettings.wholesale,
      priceSettings.wholesaleUsesSameAsRetail
    )
  );

  return (
    <div className="flex flex-col gap-1 rounded-md bg-muted/50 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">
        Calculated from Price Settings
      </span>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
        <span>
          Retail:{" "}
          <span className="font-medium tabular-nums">
            {retailPrice != null ? formatMoney(retailPrice, variant.currency) : "—"}
          </span>
        </span>
        <span>
          Wholesale:{" "}
          <span className="font-medium tabular-nums">
            {wholesalePrice != null ? formatMoney(wholesalePrice, variant.currency) : "—"}
          </span>
        </span>
      </div>
    </div>
  );
}

function VariantEditForm({
  variant,
  priceSettings,
  defaultCurrency,
}: {
  variant: EditableVariant;
  priceSettings: OrganisationPriceSettings | null;
  /** The organisation's CURRENT Price Settings currency — not
   *  variant.currency. Saving this form re-syncs the variant's stored
   *  currency to this value regardless of what it was before (products/
   *  actions.ts's updateVariant), so the read-only display here shows what
   *  it will become, not what it currently is. */
  defaultCurrency: Currency;
}) {
  const [state, formAction, pending] = useActionState(updateVariant, undefined);
  const idPrefix = `edit-variant-${variant.id}`;
  const router = useRouter();

  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
    >
      <input type="hidden" name="variantId" value={variant.id} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{variant.name}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {variant.onHand} on hand
        </span>
      </div>

      <Field orientation="responsive">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-name`}>Variant</FieldLabel>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            defaultValue={variant.name}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-sku`}>SKU</FieldLabel>
          <Input
            id={`${idPrefix}-sku`}
            name="sku"
            defaultValue={variant.sku}
            required
          />
        </Field>
      </Field>
      <Field orientation="responsive">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-barcode`}>Barcode</FieldLabel>
          <Input
            id={`${idPrefix}-barcode`}
            name="barcode"
            defaultValue={variant.barcode ?? ""}
            placeholder="Optional"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-unit`}>Unit</FieldLabel>
          <Select name="unit" defaultValue={variant.unit} items={UNIT_ITEMS}>
            <SelectTrigger id={`${idPrefix}-unit`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VARIANT_UNITS.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Field>

      <VariantPricingFields
        idPrefix={idPrefix}
        defaultPackPrice={variant.packPrice}
        defaultUnitsPerPack={variant.unitsPerPack}
        defaultUnitPrice={variant.unitPrice}
      />

      <CalculatedPrices variant={variant} priceSettings={priceSettings} />

      {/* After all the price fields, including retail/wholesale above —
          per the read-only currency display's own placement rule. */}
      <ReadOnlyCurrencyField idPrefix={idPrefix} currency={defaultCurrency} />

      {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}

      <Button
        type="submit"
        size="sm"
        variant="outline"
        className="w-fit"
        disabled={pending}
      >
        {pending ? "Saving…" : "Save variant"}
      </Button>
    </form>
  );
}

function DeleteProductSection({
  product,
  onDeleted,
}: {
  product: EditableProduct;
  onDeleted?: (result: "deleted" | "deactivated") => void;
}) {
  const [state, formAction, pending] = useActionState(deleteProduct, undefined);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state && "ok" in state) {
      // The actual bug fix: on desktop, onDeleted just closes the panel
      // (setSelectedProductId(null)) — no navigation happens, so nothing
      // else would ever tell the already-rendered list to re-fetch. On
      // mobile, onDeleted does router.push("/products"), which happens to
      // already re-fetch on its own since it's a real navigation — but
      // calling refresh() here too is harmless, and keeps this component
      // correct on its own rather than relying on what the caller does
      // with onDeleted.
      router.refresh();
      // state.result is "deactivated" when the product had movement/PO
      // history (see the danger-zone copy above) — say so rather than
      // claiming "deleted" for a row that's actually still there.
      toastManager.add({
        title:
          state.result === "deactivated"
            ? `${product.name} deactivated`
            : `${product.name} deleted`,
        type: "success",
      });
      onDeleted?.(state.result);
    }
  }, [state, onDeleted, product.name, router]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 p-3">
      <span className="text-sm font-medium text-destructive">Danger zone</span>
      <p className="text-muted-foreground text-xs">
        If any variant has movement or purchase-order history, the product is
        deactivated (kept, marked inactive) instead of deleted.
      </p>

      {!confirming ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="w-fit"
          onClick={() => setConfirming(true)}
        >
          Delete product
        </Button>
      ) : (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="productId" value={product.id} />
          <p className="text-sm">
            Delete &ldquo;{product.name}&rdquo;? This can&apos;t be undone.
          </p>
          {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={pending}
            >
              {pending ? "Deleting…" : "Confirm delete"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * The actual editable content for a product — product fields + image,
 * per-variant edit forms, add-another-variant, and delete. Shared, unchanged,
 * between the desktop persistent side panel (ProductEditPanel) and the
 * mobile full-page edit route, so both are the same functionality in
 * different chrome.
 */
export function ProductEditContent({
  product,
  locations,
  defaultCurrency,
  priceSettings,
  onDeleted,
}: {
  product: EditableProduct;
  locations: LocationOption[];
  /** The organisation's current Price Settings currency — every variant
   *  here (new, via "Add another variant" below, and existing, via each
   *  VariantEditForm) always uses this now; there's no per-variant
   *  override anymore, so this is passed to both. */
  defaultCurrency: Currency;
  /** The organisation's saved Price Settings rates, or null if never saved
   *  — drives each variant's calculated Retail/Pack-box price display. */
  priceSettings: OrganisationPriceSettings | null;
  onDeleted?: (result: "deleted" | "deactivated") => void;
}) {
  const { can } = usePermissions();

  return (
    <div className="flex flex-col gap-4">
      {!product.isActive ? (
        <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          This product is inactive — it has movement or purchase-order history,
          so it was deactivated rather than deleted.
        </p>
      ) : null}

      <ProductFieldsForm product={product} />

      <Separator />

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium">
          Variants ({product.variants.length})
        </span>
        {product.variants.map((variant) => (
          <VariantEditForm
            key={variant.id}
            variant={variant}
            priceSettings={priceSettings}
            defaultCurrency={defaultCurrency}
          />
        ))}
        {product.variants.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No variants yet — add one below.
          </p>
        ) : null}
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Add another variant</span>
        <VariantForm
          productId={product.id}
          locations={locations}
          defaultCurrency={defaultCurrency}
        />
      </div>

      {can("products:delete") ? (
        <>
          <Separator />
          <DeleteProductSection product={product} onDeleted={onDeleted} />
        </>
      ) : null}
    </div>
  );
}
