import ExcelJS from "exceljs";

import type { RawBulkRow } from "@/lib/bulk-upload/schema";

/**
 * Server-only file parsing for bulk upload. CSV is parsed by hand (the
 * format is simple enough, and it keeps the dependency surface small);
 * .xlsx/.xls go through exceljs, which is actively maintained (unlike the
 * `xlsx`/SheetJS npm package, which carries an unpatched prototype-pollution
 * advisory — not something to run against arbitrary uploaded files). Both
 * paths only ever run server-side (this file is imported from server
 * actions), never bundled into the client.
 */
export async function parseBulkUploadFile(file: File): Promise<RawBulkRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = await file.text();
    return parseCsv(text);
  }
  return parseXlsx(await file.arrayBuffer());
}

function parseCsv(text: string): RawBulkRow[] {
  const rows = splitCsvRows(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).filter(hasAnyValue).map((cells) => {
    const row: RawBulkRow = {};
    header.forEach((key, i) => {
      row[key] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

function hasAnyValue(cells: string[]): boolean {
  return cells.some((c) => c.trim() !== "");
}

/** Minimal RFC4180 CSV parser: handles quoted fields, embedded commas and
 * newlines, and doubled-quote escaping. */
function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // swallow; \n (if present) closes the row on the next iteration
    } else {
      field += c;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

async function parseXlsx(buffer: ArrayBuffer): Promise<RawBulkRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const header: string[] = [];
  const rows: RawBulkRow[] = [];

  sheet.eachRow((sheetRow, rowNumber) => {
    const values = sheetRow.values as (ExcelJS.CellValue | undefined)[];
    // exceljs' `.values` is 1-indexed with a leading empty slot at index 0.
    const cells = values.slice(1).map(cellToString);

    if (rowNumber === 1) {
      header.push(...cells.map((c) => c.trim()));
      return;
    }
    if (cells.every((c) => c.trim() === "")) return;

    const row: RawBulkRow = {};
    header.forEach((key, i) => {
      row[key] = (cells[i] ?? "").trim();
    });
    rows.push(row);
  });

  return rows;
}

function cellToString(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue);
    if (value instanceof Date) return value.toISOString();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("");
    }
    return String(value);
  }
  return String(value);
}
