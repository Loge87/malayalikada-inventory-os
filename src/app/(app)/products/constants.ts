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

// Standard world (ISO 4217) currency codes — the major/commonly-traded set
// rather than every ISO 4217 code (~180, most never relevant here), easily
// extended since this is validated app-side rather than a DB CHECK
// constraint, so adding one later doesn't need a migration. Used both for a
// variant's own currency (product_variants.currency) and the organisation's
// default_currency (organisations.default_currency, 0017_*.sql) — one list,
// so the two can never drift out of sync with each other.
export const CURRENCIES = [
  "NZD", "AUD", "USD", "GBP", "EUR", "CAD", "JPY", "CNY", "INR", "SGD",
  "HKD", "CHF", "AED", "SAR", "QAR", "KWD", "ZAR", "THB", "MYR", "IDR",
  "PHP", "VND", "KRW", "SEK", "NOK", "DKK", "PLN", "MXN", "BRL", "FJD",
  "PGK", "WST", "TOP", "LKR", "NPR", "PKR", "BDT", "EGP", "NGN", "KES",
] as const;
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
