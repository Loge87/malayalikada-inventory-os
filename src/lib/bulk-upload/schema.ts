import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  VARIANT_UNITS,
  type Currency,
  type VariantUnit,
} from "@/app/(app)/products/constants";

/** Column order for the downloadable template and the parsed-row shape —
 * matches the bulk-upload spec exactly. */
export const BULK_UPLOAD_COLUMNS = [
  "product_name",
  "category",
  "brand",
  "variant_name",
  "sku",
  "barcode",
  "unit",
  "currency",
  "pack_price",
  "units_per_pack",
  "unit_price",
  "initial_quantity",
  "initial_location_name",
] as const;

const REQUIRED_COLUMNS = [
  "product_name",
  "category",
  "variant_name",
  "sku",
  "unit",
] as const;

export type RawBulkRow = Record<string, string>;

export type NormalizedBulkRow = {
  productName: string;
  category: string;
  brand: string | null;
  variantName: string;
  sku: string;
  barcode: string | null;
  unit: VariantUnit;
  currency: Currency;
  packPrice: number | null;
  unitsPerPack: number;
  unitPrice: number | null;
  initialQuantity: number | null;
  initialLocationName: string | null;
};

export type BulkRowResult =
  | { line: number; status: "valid"; data: NormalizedBulkRow; raw: RawBulkRow }
  | {
      line: number;
      status: "error";
      errors: string[];
      raw: RawBulkRow;
    }
  | {
      line: number;
      status: "skipped_duplicate";
      sku: string;
      reason: string;
      raw: RawBulkRow;
    };

export type BulkValidationContext = {
  /** Trimmed, lowercased SKUs that already exist for this organisation. */
  existingSkusLower: ReadonlySet<string>;
  /** Location name (trimmed, lowercased) -> canonical { id, name }. */
  locationsByNameLower: ReadonlyMap<string, { id: string; name: string }>;
};

function cell(row: RawBulkRow, key: string): string {
  return (row[key] ?? "").toString().trim();
}

function parseOptionalNumber(
  raw: string,
  { positive = false }: { positive?: boolean } = {}
): { ok: true; value: number | null } | { ok: false } {
  if (raw === "") return { ok: true, value: null };
  const value = Number(raw);
  if (!Number.isFinite(value)) return { ok: false };
  if (positive ? value <= 0 : value < 0) return { ok: false };
  return { ok: true, value };
}

/**
 * Validates one already-parsed spreadsheet row against the bulk-upload
 * column contract. Pure — no I/O — so it runs identically for the client
 * preview and the server-side re-check just before import. Cross-row
 * concerns (duplicate SKUs) are handled by `validateBulkRows` below, which
 * calls this per row first.
 */
function validateRow(
  raw: RawBulkRow,
  line: number,
  context: BulkValidationContext
): BulkRowResult {
  const errors: string[] = [];

  for (const column of REQUIRED_COLUMNS) {
    if (cell(raw, column) === "") {
      errors.push(`${column} is required`);
    }
  }

  const productName = cell(raw, "product_name");
  const category = cell(raw, "category");
  const variantName = cell(raw, "variant_name");
  const sku = cell(raw, "sku");
  const brand = cell(raw, "brand") || null;
  const barcode = cell(raw, "barcode") || null;

  const unitRaw = cell(raw, "unit");
  const unit = unitRaw as VariantUnit;
  if (unitRaw !== "" && !VARIANT_UNITS.includes(unit)) {
    errors.push(
      `unit "${unitRaw}" is not one of: ${VARIANT_UNITS.join(", ")}`
    );
  }

  const currencyRaw = cell(raw, "currency");
  const currency = (currencyRaw || DEFAULT_CURRENCY) as Currency;
  if (currencyRaw !== "" && !CURRENCIES.includes(currency)) {
    errors.push(`currency "${currencyRaw}" is not one of: ${CURRENCIES.join(", ")}`);
  }

  const packPriceResult = parseOptionalNumber(cell(raw, "pack_price"));
  if (!packPriceResult.ok) errors.push("pack_price must be a non-negative number");

  const unitsPerPackRaw = cell(raw, "units_per_pack");
  const unitsPerPackResult =
    unitsPerPackRaw === ""
      ? { ok: true as const, value: 1 }
      : parseOptionalNumber(unitsPerPackRaw, { positive: true });
  if (!unitsPerPackResult.ok) errors.push("units_per_pack must be a positive number");

  const unitPriceResult = parseOptionalNumber(cell(raw, "unit_price"));
  if (!unitPriceResult.ok) errors.push("unit_price must be a non-negative number");

  const initialQuantityResult = parseOptionalNumber(cell(raw, "initial_quantity"), {
    positive: true,
  });
  if (!initialQuantityResult.ok) {
    errors.push("initial_quantity must be a positive number");
  }

  const initialLocationNameRaw = cell(raw, "initial_location_name");
  let resolvedLocationName: string | null = null;
  const wantsInitialStock =
    initialQuantityResult.ok && initialQuantityResult.value !== null;

  if (wantsInitialStock) {
    if (initialLocationNameRaw === "") {
      errors.push("initial_location_name is required when initial_quantity is set");
    } else {
      const match = context.locationsByNameLower.get(
        initialLocationNameRaw.toLowerCase()
      );
      if (!match) {
        errors.push(`initial_location_name "${initialLocationNameRaw}" doesn't match any location`);
      } else {
        resolvedLocationName = match.name;
      }
    }
  }

  if (errors.length > 0) {
    return { line, status: "error", errors, raw };
  }

  return {
    line,
    status: "valid",
    raw,
    data: {
      productName,
      category,
      brand,
      variantName,
      sku,
      barcode,
      unit,
      currency,
      packPrice: packPriceResult.ok ? packPriceResult.value : null,
      unitsPerPack: unitsPerPackResult.ok ? (unitsPerPackResult.value ?? 1) : 1,
      unitPrice: unitPriceResult.ok ? unitPriceResult.value : null,
      initialQuantity: wantsInitialStock
        ? (initialQuantityResult.ok ? initialQuantityResult.value : null)
        : null,
      initialLocationName: wantsInitialStock ? resolvedLocationName : null,
    },
  };
}

/**
 * Validates every parsed row, then applies the duplicate-SKU rule across the
 * whole file: a SKU that already exists in the organisation, or that appears
 * more than once in the file, gets every one of its rows skipped rather than
 * imported or used to update an existing product (per the bulk-upload spec —
 * duplicates never update existing rows).
 */
export function validateBulkRows(
  rawRows: RawBulkRow[],
  context: BulkValidationContext
): BulkRowResult[] {
  const perRow = rawRows.map((raw, i) => validateRow(raw, i + 2, context));

  const skuOccurrences = new Map<string, number>();
  for (const result of perRow) {
    if (result.status !== "valid") continue;
    const key = result.data.sku.toLowerCase();
    skuOccurrences.set(key, (skuOccurrences.get(key) ?? 0) + 1);
  }

  return perRow.map((result) => {
    if (result.status !== "valid") return result;
    const key = result.data.sku.toLowerCase();
    const inFileCount = skuOccurrences.get(key) ?? 0;
    if (context.existingSkusLower.has(key)) {
      return {
        line: result.line,
        status: "skipped_duplicate",
        sku: result.data.sku,
        reason: "SKU already exists in this organisation",
        raw: result.raw,
      };
    }
    if (inFileCount > 1) {
      return {
        line: result.line,
        status: "skipped_duplicate",
        sku: result.data.sku,
        reason: "SKU appears more than once in this file",
        raw: result.raw,
      };
    }
    return result;
  });
}

export function bulkUploadTemplateCsv(): string {
  const header = BULK_UPLOAD_COLUMNS.join(",");
  const example = [
    "Basmati Rice",
    "Grains",
    "Tilda",
    "5kg bag",
    "RICE-BAS-5KG",
    "1234567890123",
    "each",
    "NZD",
    "18.50",
    "1",
    "18.50",
    "50",
    "Main Warehouse",
  ].join(",");
  return `${header}\n${example}\n`;
}
