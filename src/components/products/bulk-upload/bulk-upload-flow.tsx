"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Download, UploadCloud } from "lucide-react";

import {
  importBulkUpload,
  previewBulkUpload,
} from "@/app/(app)/products/bulk-upload/actions";
import { bulkUploadTemplateCsv } from "@/lib/bulk-upload/schema";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { BulkRowStatusPill } from "@/components/products/bulk-upload/bulk-row-status-pill";
import { toastManager } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(bulkUploadTemplateCsv())}`;

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function BulkUploadFlow() {
  const [previewState, previewAction, previewPending] = useActionState(
    previewBulkUpload,
    undefined
  );
  const [importState, importAction, importPending] = useActionState(
    importBulkUpload,
    undefined
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  function acceptFile(file: File) {
    if (!hasAcceptedExtension(file.name)) {
      setDropError("That file isn't a CSV or Excel (.xlsx/.xls) file.");
      return;
    }
    setDropError(null);
    // Programmatically assigning a dropped file to the file input's FileList
    // (via DataTransfer) is the standard way to make a native <input
    // type="file"> — and the FormData a submit reads from it — see the file
    // as if the user had picked it themselves, so previewAction needs no
    // separate code path for a dropped file.
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    if (fileInputRef.current) {
      fileInputRef.current.files = dataTransfer.files;
    }
    setSelectedFileName(file.name);
  }

  const preview = previewState && "ok" in previewState ? previewState : null;
  const validRowsJson = useMemo(() => {
    if (!preview) return "[]";
    return JSON.stringify(
      preview.results.filter((r) => r.status === "valid").map((r) => r.data)
    );
  }, [preview]);

  const imported = importState && "ok" in importState ? importState : null;

  // Bulk import creates many products in one submit, so the literal
  // "[Product name] added" wording doesn't fit — a count summary instead.
  useEffect(() => {
    if (imported && imported.created > 0) {
      toastManager.add({
        title: `${imported.created} product${imported.created === 1 ? "" : "s"} added`,
        type: "success",
      });
    }
  }, [imported]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Choose a file</CardTitle>
          <CardDescription>
            CSV or Excel (.xlsx). Not sure of the columns?{" "}
            <a
              href={TEMPLATE_HREF}
              download="bulk-upload-template.csv"
              className="inline-flex items-center gap-1 underline"
            >
              <Download className="size-3.5" />
              Download the template
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={previewAction}>
            <FieldGroup>
              <Field>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDraggingOver(true);
                  }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingOver(false);
                    const file = event.dataTransfer.files?.[0];
                    if (file) acceptFile(file);
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                    isDraggingOver
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <UploadCloud className="size-6 text-muted-foreground" />
                  <p className="text-sm">
                    {selectedFileName ? (
                      <span className="font-medium">{selectedFileName}</span>
                    ) : (
                      <>
                        Drag and drop a CSV or Excel file here, or{" "}
                        <span className="underline">browse</span>
                      </>
                    )}
                  </p>
                </div>
                <Input
                  ref={fileInputRef}
                  id="bulk-file"
                  name="file"
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  required
                  className="mt-2"
                  onChange={(event) => {
                    setDropError(null);
                    setSelectedFileName(event.target.files?.[0]?.name ?? null);
                  }}
                />
                <FieldDescription>
                  Required columns: product_name, category, variant_name, sku,
                  unit. Optional: brand, barcode, currency (default NZD),
                  unit_price, units_per_pack (default 1), pack_price,
                  initial_quantity, initial_location_name (required if
                  initial_quantity is set). Retail price and wholesale
                  price aren&apos;t columns — both are calculated from unit
                  price / pack price and your Price Settings.
                </FieldDescription>
              </Field>
              {dropError ? <FieldError>{dropError}</FieldError> : null}
              {previewState && "error" in previewState ? (
                <FieldError>{previewState.error}</FieldError>
              ) : null}
              <Button type="submit" disabled={previewPending}>
                {previewPending ? "Reading file…" : "Preview import"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>2. Review</CardTitle>
            <CardDescription>
              {preview.counts.valid} will import · {preview.counts.skipped}{" "}
              skipped (duplicate SKU) · {preview.counts.error} with errors.
              Only rows marked &quot;Will import&quot; are written — nothing
              here updates an existing product.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-md ring-1 ring-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Line</th>
                    <th className="px-3 py-2 font-medium">Product / variant</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.results.map((r) => (
                    <tr
                      key={r.line}
                      className={cn(
                        "transition-colors hover:bg-muted/40",
                        r.status === "error" && "bg-status-critical/5"
                      )}
                    >
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {r.line}
                      </td>
                      <td className="px-3 py-2">
                        {r.status === "valid"
                          ? `${r.data.productName} — ${r.data.variantName}`
                          : `${r.raw.product_name ?? ""} ${r.raw.variant_name ? `— ${r.raw.variant_name}` : ""}`.trim() || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {r.status === "valid" ? r.data.sku : r.raw.sku || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <BulkRowStatusPill status={r.status} />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.status === "error"
                          ? r.errors.join("; ")
                          : r.status === "skipped_duplicate"
                            ? r.reason
                            : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {imported ? (
              <div className="rounded-md bg-status-success/10 p-3 text-sm text-status-success">
                Import complete — created {imported.created}, skipped{" "}
                {imported.skipped}
                {imported.errors > 0 ? `, ${imported.errors} failed` : ""}.
              </div>
            ) : (
              <form action={importAction} className="flex flex-col gap-2">
                <input type="hidden" name="rows" value={validRowsJson} />
                {importState && "error" in importState ? (
                  <FieldError>{importState.error}</FieldError>
                ) : null}
                <Button
                  type="submit"
                  disabled={importPending || preview.counts.valid === 0}
                  className="w-fit"
                >
                  {importPending
                    ? "Importing…"
                    : `Confirm import (${preview.counts.valid})`}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}

      {imported ? (
        <a href="/products" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
          Back to products
        </a>
      ) : null}
    </div>
  );
}
