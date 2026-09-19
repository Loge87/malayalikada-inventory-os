"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentOrganisationId,
  getOrganisationDefaultCurrency,
} from "@/lib/organisation";
import { parseBulkUploadFile } from "@/lib/bulk-upload/parse-file";
import {
  validateBulkRows,
  type BulkRowResult,
  type BulkValidationContext,
  type NormalizedBulkRow,
} from "@/lib/bulk-upload/schema";

/** The sku/barcode/location queries are RLS-scoped to the caller's
 * organisation already — no explicit organisation_id filter needed (or
 * wanted) there; the default-currency lookup needs it explicitly since
 * organisations is looked up by id, not by an implicit "mine" scope. */
async function loadValidationContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organisationId: string
): Promise<BulkValidationContext> {
  const [variantsRes, locationsRes, defaultCurrency] = await Promise.all([
    supabase.from("product_variants").select("sku, barcode"),
    supabase.from("locations").select("id, name").eq("is_active", true),
    getOrganisationDefaultCurrency(supabase, organisationId),
  ]);

  if (variantsRes.error) throw variantsRes.error;
  if (locationsRes.error) throw locationsRes.error;

  const existingSkusLower = new Set(
    (variantsRes.data ?? []).map((r) => r.sku.trim().toLowerCase())
  );
  const existingBarcodesLower = new Set(
    (variantsRes.data ?? [])
      .map((r) => r.barcode?.trim().toLowerCase())
      .filter((b): b is string => Boolean(b))
  );
  const locationsByNameLower = new Map(
    (locationsRes.data ?? []).map((l) => [
      l.name.trim().toLowerCase(),
      { id: l.id as string, name: l.name as string },
    ])
  );

  return {
    existingSkusLower,
    existingBarcodesLower,
    locationsByNameLower,
    defaultCurrency,
  };
}

export type PreviewBulkUploadState =
  | { error: string }
  | {
      ok: true;
      results: BulkRowResult[];
      counts: { valid: number; skipped: number; error: number };
    }
  | undefined;

/**
 * Parses an uploaded CSV/Excel file and validates every row against the
 * organisation's current SKUs and locations, without writing anything yet.
 * The client renders this preview and only submits the `valid` rows to
 * `importBulkUpload` on confirm.
 */
export async function previewBulkUpload(
  _prevState: PreviewBulkUploadState,
  formData: FormData
): Promise<PreviewBulkUploadState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV or Excel file." };
  }

  const supabase = await createClient();
  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  let rawRows;
  try {
    rawRows = await parseBulkUploadFile(file);
  } catch (err) {
    return {
      error: `Could not read that file: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }

  if (rawRows.length === 0) {
    return { error: "That file has no data rows." };
  }

  const context = await loadValidationContext(supabase, organisationId);
  const results = validateBulkRows(rawRows, context);

  const counts = { valid: 0, skipped: 0, error: 0 };
  for (const r of results) {
    if (r.status === "valid") counts.valid++;
    else if (r.status === "skipped_duplicate") counts.skipped++;
    else counts.error++;
  }

  return { ok: true, results, counts };
}

export type ImportBulkUploadState =
  | { error: string }
  | { ok: true; created: number; skipped: number; errors: number }
  | undefined;

/**
 * Imports the rows the client's preview marked `valid`. Re-checks SKUs
 * against the database right before writing (a row valid a minute ago may
 * have been created by someone else since) and relies on the
 * `(organisation_id, sku)` unique constraint as a final backstop — a
 * collision there is treated the same as a preview-time duplicate: skipped,
 * never an overwrite of the existing product. Every row goes through
 * create_product_with_variant, the same function /products/new uses, so
 * initial stock is always recorded via record_inventory_movement, never a
 * direct inventory_levels write.
 */
export async function importBulkUpload(
  _prevState: ImportBulkUploadState,
  formData: FormData
): Promise<ImportBulkUploadState> {
  const rowsJson = String(formData.get("rows") ?? "");
  let rows: NormalizedBulkRow[];
  try {
    rows = JSON.parse(rowsJson);
  } catch {
    return { error: "Malformed import payload." };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No valid rows to import." };
  }

  const supabase = await createClient();
  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const context = await loadValidationContext(supabase, organisationId);
  const seenSkusLower = new Set<string>();
  const seenBarcodesLower = new Set<string>();

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const skuLower = row.sku.trim().toLowerCase();
    const barcodeLower = row.barcode?.trim().toLowerCase() || null;

    if (context.existingSkusLower.has(skuLower) || seenSkusLower.has(skuLower)) {
      skipped++;
      continue;
    }
    // Same "don't create a duplicate product" rule as SKU, re-checked here
    // for the same reason (a row valid at preview time may have been
    // created by someone else since) — only when this row actually has a
    // barcode.
    if (
      barcodeLower &&
      (context.existingBarcodesLower.has(barcodeLower) || seenBarcodesLower.has(barcodeLower))
    ) {
      skipped++;
      continue;
    }

    const locationId = row.initialLocationName
      ? context.locationsByNameLower.get(row.initialLocationName.trim().toLowerCase())?.id ?? null
      : null;

    const { error } = await supabase.rpc("create_product_with_variant", {
      p_organisation_id: organisationId,
      p_product_name: row.productName,
      p_category: row.category,
      p_brand: row.brand,
      p_variant_name: row.variantName,
      p_sku: row.sku,
      p_barcode: row.barcode,
      p_unit: row.unit,
      p_currency: row.currency,
      p_pack_price: row.packPrice,
      p_units_per_pack: row.unitsPerPack,
      p_unit_price: row.unitPrice,
      p_initial_location_id: locationId,
      p_initial_quantity: row.initialQuantity,
    });

    if (error) {
      // 23505 = unique_violation, i.e. the (organisation_id, sku) constraint
      // — someone/something created this SKU between preview and import.
      if (error.code === "23505") {
        skipped++;
      } else {
        errors++;
      }
      continue;
    }

    seenSkusLower.add(skuLower);
    if (barcodeLower) {
      seenBarcodesLower.add(barcodeLower);
    }
    created++;
  }

  revalidatePath("/products");
  return { ok: true, created, skipped, errors };
}
