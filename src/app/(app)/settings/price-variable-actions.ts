"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganisationId } from "@/lib/organisation";
import { getCurrentUserRole } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import {
  PRICE_VARIABLE_TYPES,
  type PriceVariableType,
} from "@/lib/price-variable-types";

export type PriceVariableFormState = { error: string } | { ok: true } | undefined;

/** Postgres' unique_violation code — used to turn a duplicate-name insert/
 *  update into a friendly message instead of a raw constraint error string. */
const UNIQUE_VIOLATION = "23505";

function parseVariableFields(
  formData: FormData
): { error: string } | { name: string; value: number; valueType: PriceVariableType } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Name is required." };
  }

  const rawValue = String(formData.get("value") ?? "").trim();
  const value = Number(rawValue);
  if (rawValue === "" || !Number.isFinite(value)) {
    return { error: "Value must be a number." };
  }

  const valueType = String(formData.get("valueType") ?? "");
  if (!PRICE_VARIABLE_TYPES.includes(valueType as PriceVariableType)) {
    return { error: "Choose a value type." };
  }

  return { name, value, valueType: valueType as PriceVariableType };
}

/**
 * Creates one named price variable (e.g. "GST" = 9, percentage) — reusable
 * across both the retail and wholesale formula canvases (Stage 3+), since
 * price_variables isn't scoped to a formula_type.
 */
export async function createPriceVariable(
  _prevState: PriceVariableFormState,
  formData: FormData
): Promise<PriceVariableFormState> {
  const parsed = parseVariableFields(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();

  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "pricing:manage")) {
    return { error: "Only an admin or owner can manage price variables." };
  }

  const organisationId = await getCurrentOrganisationId(supabase);
  if (!organisationId) {
    return { error: "Could not determine your organisation." };
  }

  const { error } = await supabase.from("price_variables").insert({
    organisation_id: organisationId,
    name: parsed.name,
    value: parsed.value,
    value_type: parsed.valueType,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: `A variable named "${parsed.name}" already exists.` };
    }
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

/** Updates a variable's own fields. Relies on RLS (organisation_id in
 *  user_org_ids()) to scope the update to the caller's org, same as
 *  updateLocation/updateClient — no explicit organisation_id filter here. */
export async function updatePriceVariable(
  _prevState: PriceVariableFormState,
  formData: FormData
): Promise<PriceVariableFormState> {
  const variableId = String(formData.get("variableId") ?? "");
  if (!variableId) {
    return { error: "Missing variable." };
  }

  const parsed = parseVariableFields(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();

  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "pricing:manage")) {
    return { error: "Only an admin or owner can manage price variables." };
  }

  const { error } = await supabase
    .from("price_variables")
    .update({
      name: parsed.name,
      value: parsed.value,
      value_type: parsed.valueType,
    })
    .eq("id", variableId);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: `A variable named "${parsed.name}" already exists.` };
    }
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Deletes a variable outright — no "deactivate instead" fallback the way
 * deleteLocation/deleteProduct have, since nothing in the schema references
 * price_variables.id via a real foreign key (a formula graph's nodes only
 * hold a variable's id inside jsonb, Stage 3+). A canvas node pointing at a
 * since-deleted variable is a Stage 4 evaluator concern (treated as
 * unresolvable, same as any other disconnected/invalid node), not something
 * this action needs to check for.
 */
export async function deletePriceVariable(
  _prevState: PriceVariableFormState,
  formData: FormData
): Promise<PriceVariableFormState> {
  const variableId = String(formData.get("variableId") ?? "");
  if (!variableId) {
    return { error: "Missing variable." };
  }

  const supabase = await createClient();

  const role = await getCurrentUserRole(supabase);
  if (!hasPermission(role, "pricing:manage")) {
    return { error: "Only an admin or owner can manage price variables." };
  }

  const { error } = await supabase
    .from("price_variables")
    .delete()
    .eq("id", variableId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}
