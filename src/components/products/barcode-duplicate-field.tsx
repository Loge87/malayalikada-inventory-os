"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { checkBarcodeExists } from "@/app/(app)/products/actions";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The create-product form's own barcode field — checks for an existing
 * product immediately, not at form submit: on Enter (a hardware scanner
 * typed directly into this field, rather than through AddProductMenu's own
 * scan dialog) and on blur (plain manual typing, which never fires Enter).
 * Same checkBarcodeExists() AddProductMenu's camera/hardware-scanner path
 * uses — one shared check, not a second implementation.
 *
 * Reports the current duplicate (or lack of one) to the parent via
 * `onDuplicateChange`, so NewProductForm can disable submit while a
 * duplicate is flagged — scanning/typing a barcode is often the very first
 * thing filled in, so this can surface before any time is spent on the
 * rest of the form.
 */
export function BarcodeDuplicateField({
  id,
  defaultValue,
  onDuplicateChange,
}: {
  id: string;
  defaultValue: string;
  onDuplicateChange: (
    duplicate: { productId: string; productName: string } | null
  ) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [checking, setChecking] = useState(false);
  const [duplicate, setDuplicate] = useState<
    { productId: string; productName: string } | null
  >(null);
  // Avoids re-checking the same value twice in a row (e.g. blurring, then
  // tabbing back in and out again without changing anything).
  const lastCheckedRef = useRef<string | null>(null);

  async function runCheck(barcode: string) {
    const trimmed = barcode.trim();
    if (trimmed === lastCheckedRef.current) {
      return;
    }
    lastCheckedRef.current = trimmed;

    if (!trimmed) {
      setDuplicate(null);
      onDuplicateChange(null);
      return;
    }

    setChecking(true);
    const result = await checkBarcodeExists(trimmed);
    setChecking(false);
    const next = result.exists
      ? { productId: result.productId, productName: result.productName }
      : null;
    setDuplicate(next);
    onDuplicateChange(next);
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>Barcode</FieldLabel>
      <Input
        id={id}
        name="barcode"
        value={value}
        placeholder="Optional"
        className={cn(value && "font-mono")}
        onChange={(event) => {
          setValue(event.target.value);
          // Only the DISPLAYED warning clears immediately on edit — the
          // actual re-check still waits for Enter/blur, per the "not on
          // every keystroke" requirement.
          if (duplicate) {
            setDuplicate(null);
            onDuplicateChange(null);
          }
        }}
        onBlur={(event) => runCheck(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            // Stops a hardware scanner's Enter from submitting the whole
            // form early — this field's own check runs instead.
            event.preventDefault();
            runCheck(value);
          }
        }}
      />
      {checking ? (
        <FieldDescription>Checking…</FieldDescription>
      ) : duplicate ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
          <span>This product already exists ({duplicate.productName}).</span>
          <Link
            href={`/products/${duplicate.productId}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View existing product
          </Link>
        </div>
      ) : null}
    </Field>
  );
}
