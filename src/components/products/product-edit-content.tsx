"use client";

import { useActionState, useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";

import {
  deleteProduct,
  updateProduct,
  updateVariant,
} from "@/app/(app)/products/actions";
import { VARIANT_UNITS, type Currency } from "@/app/(app)/products/constants";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
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
import { VariantForm } from "@/components/products/variant-form";
import { VariantPricingFields } from "@/components/products/variant-pricing-fields";
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
  const [preview, setPreview] = useState<string | null>(null);
  const idPrefix = `edit-product-${product.id}`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="productId" value={product.id} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-image`}>Product image</FieldLabel>
          <div className="flex items-center gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
              {preview || product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview ?? product.imageUrl ?? undefined}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <ImageIcon className="size-6 text-muted-foreground" />
              )}
            </div>
            <Input
              id={`${idPrefix}-image`}
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </div>
          <FieldDescription>PNG, JPEG, or WEBP, up to 5MB.</FieldDescription>
        </Field>

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

function VariantEditForm({ variant }: { variant: EditableVariant }) {
  const [state, formAction, pending] = useActionState(updateVariant, undefined);
  const idPrefix = `edit-variant-${variant.id}`;

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
        defaultCurrency={variant.currency as Currency}
        defaultPackPrice={variant.packPrice}
        defaultUnitsPerPack={variant.unitsPerPack}
        defaultUnitPrice={variant.unitPrice}
      />

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

  useEffect(() => {
    if (state && "ok" in state) {
      onDeleted?.(state.result);
    }
  }, [state, onDeleted]);

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
 * between the desktop side panel (ProductEditDrawer) and the mobile full-page
 * edit route, so both are the same functionality in different chrome.
 */
export function ProductEditContent({
  product,
  locations,
  onDeleted,
}: {
  product: EditableProduct;
  locations: LocationOption[];
  onDeleted?: (result: "deleted" | "deactivated") => void;
}) {
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
          <VariantEditForm key={variant.id} variant={variant} />
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
        <VariantForm productId={product.id} locations={locations} />
      </div>

      <Separator />

      <DeleteProductSection product={product} onDeleted={onDeleted} />
    </div>
  );
}
