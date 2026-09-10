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

export type ProductFormState = { error: string } | { ok: true } | undefined;
