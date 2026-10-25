/**
 * Product type — a pricing factor. A price variable can be limited to one
 * type (price_variables.applies_to_type); when a formula is evaluated for a
 * product, variables that don't apply to that product's type are skipped.
 */
export const PRODUCT_TYPES = ["frozen", "dry"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  frozen: "Frozen",
  dry: "Dry",
};

export const VARIABLE_SCOPES = ["all", ...PRODUCT_TYPES] as const;
export type VariableScope = (typeof VARIABLE_SCOPES)[number];

export const VARIABLE_SCOPE_LABELS: Record<VariableScope, string> = {
  all: "All products",
  frozen: "Frozen only",
  dry: "Dry only",
};

export function isProductType(value: unknown): value is ProductType {
  return typeof value === "string" && (PRODUCT_TYPES as readonly string[]).includes(value);
}

export function isVariableScope(value: unknown): value is VariableScope {
  return typeof value === "string" && (VARIABLE_SCOPES as readonly string[]).includes(value);
}
