/**
 * Shared types and logic for the Price Formula chain builder — consumed by
 * both the chain UI (src/components/settings/price-formula-chain.tsx) and
 * the server (src/app/(app)/settings/page.tsx). A formula is a flat,
 * left-to-right sequence: a fixed starting value (the product's own current
 * unit_price / pack_price — never stored here, always read live at
 * evaluation time), then zero or more (operator, step) entries applied in
 * order. A step is either a reference to a saved variable, or a GROUP — a
 * self-contained nested chain (no implied starting value of its own; its
 * first entry IS the seed, the rest apply against it) that resolves to one
 * number before the parent chain uses it like any other step. No x/y
 * layout to persist — array order (and, for groups, nesting) alone fully
 * encodes the formula.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PriceVariable } from "@/lib/price-variable-types";

export type FormulaType = "retail" | "wholesale";

export const OPERATOR_KINDS = ["add", "subtract", "multiply", "divide"] as const;
export type OperatorKind = (typeof OPERATOR_KINDS)[number];

export const OPERATOR_SYMBOLS: Record<OperatorKind, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
};

export const OPERATOR_LABELS: Record<OperatorKind, string> = {
  add: "Add",
  subtract: "Subtract",
  multiply: "Multiply",
  divide: "Divide",
};

/**
 * One distinct color per operator, so a glance at the chain tells +/−/×/÷
 * apart without reading the glyph — reuses the dashboard's existing
 * chart-1..4 categorical palette (theme.css: already CVD-validated, already
 * defined for both light and dark mode) rather than inventing new colors
 * single-purpose to this canvas. Tailwind utility names, since every
 * consumer is a className string.
 */
export const OPERATOR_COLOR_CLASS: Record<OperatorKind, string> = {
  add: "border-chart-1 text-chart-1",
  subtract: "border-chart-2 text-chart-2",
  multiply: "border-chart-3 text-chart-3",
  divide: "border-chart-4 text-chart-4",
};

export const FORMULA_START_LABEL: Record<FormulaType, string> = {
  retail: "Unit Price",
  wholesale: "Pack/Box Price",
};

export const FORMULA_RESULT_LABEL: Record<FormulaType, string> = {
  retail: "Retail Price",
  wholesale: "Wholesale Price",
};

/**
 * Maximum group nesting depth: a top-level chain may contain a group
 * (depth 1), and that group may itself contain one more nested group
 * (depth 2) — but a depth-2 group cannot contain a further group. Nothing
 * in the data model or evaluator actually requires this cap (both are
 * naturally recursive to any depth); it's enforced only in the chain UI's
 * "Add group" availability, to keep the canvas's horizontal nesting bounded
 * to what was asked for.
 */
export const MAX_GROUP_DEPTH = 2;

export type VariableStep = {
  kind: "variable";
  operator: OperatorKind;
  variableId: string;
};

export type GroupStep = {
  kind: "group";
  operator: OperatorKind;
  chain: FormulaChain;
};

export type ChainStep = VariableStep | GroupStep;

export type FormulaChain = ChainStep[];

export type FormulaStatus = "draft" | "active";

type PriceFormulaRow = {
  chain: FormulaChain;
};

/**
 * Loads the DRAFT chain the canvas edits (0030_price_formula_draft_active.sql
 * split price_formulas into one draft row and, once ever applied, one
 * active row per organisation+formula_type). Editing the draft never
 * affects what's actually computed for a real product — only
 * loadActiveFormulaChain's result does that. An organisation with no draft
 * row yet (never opened the canvas) gets an empty chain, same as before.
 */
export async function loadPriceFormulaChain(
  supabase: SupabaseClient,
  organisationId: string,
  formulaType: FormulaType
): Promise<FormulaChain> {
  const { data, error } = await supabase
    .from("price_formulas")
    .select("chain")
    .eq("organisation_id", organisationId)
    .eq("formula_type", formulaType)
    .eq("status", "draft")
    .maybeSingle<PriceFormulaRow>();

  if (error) {
    throw error;
  }

  return data?.chain ?? [];
}

/**
 * Loads the ACTIVE chain — what Apply Changes last published — never the
 * draft. `null` specifically means "no active row exists" (this
 * organisation has never applied a formula of this type), distinct from an
 * active row whose chain happens to be `[]` (applied on purpose with zero
 * steps, so the computed price equals the base price unchanged). Every
 * real retail_price/wholesale_price display reads from this, never from
 * loadPriceFormulaChain.
 */
export async function loadActiveFormulaChain(
  supabase: SupabaseClient,
  organisationId: string,
  formulaType: FormulaType
): Promise<FormulaChain | null> {
  const { data, error } = await supabase
    .from("price_formulas")
    .select("chain")
    .eq("organisation_id", organisationId)
    .eq("formula_type", formulaType)
    .eq("status", "active")
    .maybeSingle<PriceFormulaRow>();

  if (error) {
    throw error;
  }

  return data ? data.chain : null;
}

export type ActivePriceFormulas = {
  retail: FormulaChain | null;
  wholesale: FormulaChain | null;
};

export async function loadActivePriceFormulas(
  supabase: SupabaseClient,
  organisationId: string
): Promise<ActivePriceFormulas> {
  const [retail, wholesale] = await Promise.all([
    loadActiveFormulaChain(supabase, organisationId, "retail"),
    loadActiveFormulaChain(supabase, organisationId, "wholesale"),
  ]);
  return { retail, wholesale };
}

type PriceVariableRow = {
  id: string;
  name: string;
  value: number;
  value_type: PriceVariable["valueType"];
};

export type PricingContext = {
  variables: PriceVariable[];
  activeFormulas: ActivePriceFormulas;
};

/**
 * The one shared loader every retail_price/wholesale_price display site
 * calls (products list, product detail panel, /scan, /stock-out) — active
 * formulas plus the variables they reference, fetched together since
 * evaluateFormula needs both. No organisationId (no session/role) yields
 * the same shape every "nothing set up" case does, so callers don't need a
 * separate null-check branch for that.
 */
export async function loadPricingContext(
  supabase: SupabaseClient,
  organisationId: string | null
): Promise<PricingContext> {
  if (!organisationId) {
    return { variables: [], activeFormulas: { retail: null, wholesale: null } };
  }

  const [variablesRes, activeFormulas] = await Promise.all([
    supabase
      .from("price_variables")
      .select("id, name, value, value_type")
      .returns<PriceVariableRow[]>(),
    loadActivePriceFormulas(supabase, organisationId),
  ]);

  if (variablesRes.error) {
    throw variablesRes.error;
  }

  const variables: PriceVariable[] = (variablesRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    value: row.value,
    valueType: row.value_type,
  }));

  return { variables, activeFormulas };
}

export type PriceComputation =
  | { kind: "not_set" }
  | { kind: "computed"; amount: number };

/**
 * The one shared compute function every display site calls — pure, no DB
 * access (the active chain + variables are already loaded once per page via
 * loadPricingContext). `baseAmount` is always read live off the actual
 * product/variant row passed in by the caller, never cached, so a later
 * unit_price change is reflected the next time this runs. `activeChain ===
 * null` (never applied) and a missing base price both resolve to the same
 * "not_set" result — never a crash, never a silent $0.
 */
/**
 * NZ charm pricing, applied to the final computed price only — never to
 * unit_price, pack_price, or anything evaluateFormula itself touches. No
 * whole numbers ever: round to cents first, then push into .49 (decimal
 * .00–.50) or .99 (.51–.99). Cents are re-derived via a second Math.round
 * rather than read off the float subtraction directly, since
 * `rounded - wholeNumber` can land a hair off an exact cent value (e.g.
 * 0.49999999999998) due to binary floating-point — rounding that difference
 * to the nearest cent is what the spec's inclusive .50/.51 boundary
 * actually depends on.
 */
export function applyCharmPricing(rawPrice: number): number {
  const rounded = Math.round(rawPrice * 100) / 100;
  const wholeNumber = Math.floor(rounded);
  const cents = Math.round((rounded - wholeNumber) * 100);
  return cents <= 50 ? wholeNumber + 0.49 : wholeNumber + 0.99;
}

export function computeDisplayPrice(
  baseAmount: number | null,
  activeChain: FormulaChain | null,
  variables: PriceVariable[]
): PriceComputation {
  if (baseAmount === null || activeChain === null) {
    return { kind: "not_set" };
  }
  const rawAmount = evaluateFormula(baseAmount, activeChain, variables);
  return { kind: "computed", amount: applyCharmPricing(rawAmount) };
}

/**
 * A step's own contribution before it's combined into a running total: for
 * a variable step, its raw stored value plus whether that value is a
 * percentage (which changes how `applyOperator` below treats it); for a
 * group step, the group's fully-resolved result, always treated as a
 * literal number — no percentage special-casing ever applies to a group's
 * OUTPUT, no matter what's inside it (requirement: "a group's result is
 * always treated as a literal number by the parent chain").
 */
type ResolvedOperand = { value: number; isPercentage: boolean };

function resolveOperand(
  step: ChainStep,
  variableById: Map<string, PriceVariable>
): ResolvedOperand {
  if (step.kind === "group") {
    return { value: evaluateGroupChain(step.chain, variableById), isPercentage: false };
  }
  const variable = variableById.get(step.variableId);
  if (!variable) {
    // Deleted variable — same "don't crash, don't silently change the
    // formula's shape" stance as the chain UI's own "Deleted variable" box:
    // contributes 0 rather than throwing, so one missing variable doesn't
    // take down every price in the catalog.
    return { value: 0, isPercentage: false };
  }
  return { value: variable.value, isPercentage: variable.valueType === "percentage" };
}

/**
 * Applies one step's operator to the running total. Percentage-typed
 * operands are "this percent OF the running total so far" for +/−, and the
 * running total scaled BY that percentage for ×/÷ (percentage and literal
 * operands collapse to the same ×/÷ formula once the operand is
 * pre-scaled — see scaledOperand below). Literal (number/currency, and
 * always a group's own result) operands are plain arithmetic throughout.
 */
function applyOperator(
  runningTotal: number,
  operator: OperatorKind,
  operand: ResolvedOperand
): number {
  const scaledOperand = operand.isPercentage ? operand.value / 100 : operand.value;

  switch (operator) {
    case "add":
      return operand.isPercentage
        ? runningTotal + runningTotal * scaledOperand
        : runningTotal + scaledOperand;
    case "subtract":
      return operand.isPercentage
        ? runningTotal - runningTotal * scaledOperand
        : runningTotal - scaledOperand;
    case "multiply":
      return runningTotal * scaledOperand;
    case "divide":
      return runningTotal / scaledOperand;
  }
}

/**
 * Evaluates a GROUP's own mini-chain: there's no implied starting value the
 * way the top-level chain has Unit Price, so the first entry's own resolved
 * value (its operator field is ignored — nothing precedes it to combine
 * with) becomes the seed, and the rest apply left to right exactly like the
 * top-level evaluator. An empty group resolves to 0.
 */
function evaluateGroupChain(
  chain: FormulaChain,
  variableById: Map<string, PriceVariable>
): number {
  if (chain.length === 0) return 0;
  const [seedStep, ...restSteps] = chain;
  const seed = resolveOperand(seedStep, variableById).value;
  return restSteps.reduce(
    (runningTotal, step) => applyOperator(runningTotal, step.operator, resolveOperand(step, variableById)),
    seed
  );
}

/**
 * The one shared evaluation function: given a real starting price and a
 * formula's chain, walks it left to right and returns the final computed
 * number. Every display site (products list, detail panel, /scan,
 * /stock-out) is meant to call this — not re-derive the math — once Stage C
 * wires it in.
 */
export function evaluateFormula(
  startValue: number,
  chain: FormulaChain,
  variables: PriceVariable[]
): number {
  const variableById = new Map(variables.map((variable) => [variable.id, variable]));
  return chain.reduce(
    (runningTotal, step) => applyOperator(runningTotal, step.operator, resolveOperand(step, variableById)),
    startValue
  );
}

export function describeChain(
  startLabel: string,
  chain: FormulaChain,
  variables: { id: string; name: string }[]
): string {
  const nameById = new Map(variables.map((variable) => [variable.id, variable.name]));

  function describeGroup(groupChain: FormulaChain): string {
    if (groupChain.length === 0) return "";
    const [seedStep, ...restSteps] = groupChain;
    const parts = [describeStep(seedStep)];
    for (const step of restSteps) {
      parts.push(OPERATOR_SYMBOLS[step.operator], describeStep(step));
    }
    return parts.join(" ");
  }

  function describeStep(step: ChainStep): string {
    if (step.kind === "group") {
      return `(${describeGroup(step.chain)})`;
    }
    return nameById.get(step.variableId) ?? "?";
  }

  const parts = chain.map((step) => `${OPERATOR_SYMBOLS[step.operator]} ${describeStep(step)}`);
  return [startLabel, ...parts].join(" ");
}
