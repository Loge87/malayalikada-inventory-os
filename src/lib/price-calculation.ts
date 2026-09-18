/**
 * The one place retail_price / wholesale_price are computed from a base
 * price plus the organisation's Price Settings (CGST, SGST, profit margin,
 * logistics charges, additional charges — all percentages, entered as
 * whole numbers, e.g. "9" means 9%). Every display site (products list,
 * detail panel, /scan result) calls this instead of re-deriving the formula,
 * so the math can't drift out of sync between them.
 *
 *   retail_price    = unit_price × (1+cgst%) × (1+sgst%) × (1+margin%) × (1+logistics%) × (1+additional%)
 *   wholesale_price = pack_price × (1+cgst%) × (1+sgst%) × (1+margin%) × (1+logistics%) × (1+additional%)
 *
 * Same formula, different base — retail sells one at a time (unit_price),
 * wholesale sells by the case (pack_price) — one function takes the base as
 * an argument rather than being duplicated per price type. pack_price
 * itself is never run through this: it stays the plain, manually-
 * overridable unit_price × units_per_pack figure (0010_variant_pricing.sql).
 */
export type PriceSettingsRates = {
  cgstPercent: number;
  sgstPercent: number;
  profitMarginPercent: number;
  logisticsChargesPercent: number;
  additionalChargesPercent: number;
};

/** Returns null when there's no base price to apply the settings to —
 *  never 0, so callers can tell "nothing to compute" apart from a genuine
 *  zero result. */
export function applyPriceSettings(
  baseAmount: number | null,
  rates: PriceSettingsRates
): number | null {
  if (baseAmount == null) return null;

  const multiplier =
    (1 + rates.cgstPercent / 100) *
    (1 + rates.sgstPercent / 100) *
    (1 + rates.profitMarginPercent / 100) *
    (1 + rates.logisticsChargesPercent / 100) *
    (1 + rates.additionalChargesPercent / 100);

  return baseAmount * multiplier;
}
