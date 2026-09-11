export const VARIANT_UNITS = [
  "each",
  "kg",
  "g",
  "L",
  "ml",
  "pack",
  "case",
] as const;
export type VariantUnit = (typeof VARIANT_UNITS)[number];

// Easily extended — validated app-side rather than a DB CHECK constraint, so
// adding a currency later doesn't need a migration.
export const CURRENCIES = ["NZD", "AUD", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "NZD";

export type ProductFormState = { error: string } | { ok: true } | undefined;

export const PRODUCT_IMAGE_BUCKET = "product-images";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // must match the bucket's file_size_limit
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
