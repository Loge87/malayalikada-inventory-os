"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import type { FormulaChain, FormulaType } from "@/lib/price-formula";

export type SavePriceFormulaResult = { ok: true } | { error: string };

/**
 * Persists one formula's chain — the ordered (operator, variable) steps
 * applied after the fixed starting value. Called imperatively from
 * price-formula-chain.tsx on a short debounce after any change (append a
 * step, change an operator, remove a step) — not from an explicit Save
 * button/form, so this is a plain async function, not a
 * useActionState-bound action. Same autosave rationale as the earlier
 * graph canvas had: this is always editing the draft (Stage A/B), and a
 * draft has no real-world side effect to be cautious about.
 */
export async function savePriceFormula(
  formulaType: FormulaType,
  chain: FormulaChain
): Promise<SavePriceFormulaResult> {
  const supabase = await createClient();

  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "pricing:manage")) {
    return { error: "Only an admin or owner can edit the price formula." };
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const { error } = await supabase.from("price_formulas").upsert(
    {
      organisation_id: organisationId,
      formula_type: formulaType,
      status: "draft",
      chain,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organisation_id,formula_type,status" }
  );

  if (error) {
    return { error: error.message };
  }

  // No revalidatePath — this is a background save the chain UI triggers on
  // its own, not a form submission the user is waiting on a page refresh
  // for; its own client state already reflects what was just saved.
  return { ok: true };
}

export type ApplyPriceFormulaResult = { ok: true } | { error: string };

/**
 * Promotes the current DRAFT to ACTIVE for one organisation+formula_type —
 * the only thing that changes what evaluateFormula computes for real
 * products. Reads the draft fresh from the database (not whatever the
 * client last rendered) so the applied chain is exactly what's actually
 * saved, then upserts it as the active row, replacing whatever was active
 * before. The draft row itself is untouched — the canvas keeps whatever
 * was there, so the user can keep refining it after applying.
 */
export async function applyPriceFormula(
  formulaType: FormulaType
): Promise<ApplyPriceFormulaResult> {
  const supabase = await createClient();

  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "pricing:manage")) {
    return { error: "Only an admin or owner can apply the price formula." };
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const { data: draftRow, error: draftError } = await supabase
    .from("price_formulas")
    .select("chain")
    .eq("organisation_id", organisationId)
    .eq("formula_type", formulaType)
    .eq("status", "draft")
    .maybeSingle<{ chain: FormulaChain }>();

  if (draftError) {
    return { error: draftError.message };
  }

  const { error: applyError } = await supabase.from("price_formulas").upsert(
    {
      organisation_id: organisationId,
      formula_type: formulaType,
      status: "active",
      chain: draftRow?.chain ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organisation_id,formula_type,status" }
  );

  if (applyError) {
    return { error: applyError.message };
  }

  // Every real price display reads the active formula live on its own next
  // render (loadPricingContext, no caching) — nothing here needs to push a
  // notification anywhere else for prices to update.
  return { ok: true };
}
