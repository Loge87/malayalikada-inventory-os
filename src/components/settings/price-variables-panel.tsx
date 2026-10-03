"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createPriceVariable,
  deletePriceVariable,
  updatePriceVariable,
} from "@/app/(app)/settings/price-variable-actions";
import {
  formatVariableValue,
  PRICE_VARIABLE_TYPES,
  type PriceVariable,
  type PriceVariableType,
} from "@/lib/price-variable-types";
import type { Currency } from "@/app/(app)/products/constants";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastManager } from "@/components/ui/toast";

export type { PriceVariable };

const TYPE_LABELS: Record<PriceVariableType, string> = {
  number: "Number",
  percentage: "Percentage",
  currency: "Currency",
};

/**
 * One form, used for both "add a new variable" (no `editing`) and "edit this
 * one" (pre-filled, submits to updatePriceVariable instead) — the parent
 * panel remounts this component (via `key`) when switching between the two,
 * which is what resets useActionState's internal state and every
 * uncontrolled input's defaultValue cleanly, rather than tracking that by
 * hand here.
 */
function VariableForm({
  editing,
  onDone,
}: {
  editing: PriceVariable | null;
  onDone: () => void;
}) {
  const [createState, createAction, createPending] = useActionState(
    createPriceVariable,
    undefined
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updatePriceVariable,
    undefined
  );
  const router = useRouter();

  const state = editing ? updateState : createState;
  const pending = editing ? updatePending : createPending;
  const successTitle = editing ? "Variable updated" : "Variable added";

  // Render-phase "adjust state when something changes" (not an effect) —
  // same pattern as LocationRow/ProductsTable: exits edit mode once a save
  // actually completes.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state && "ok" in state) {
      onDone();
    }
  }

  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      toastManager.add({ title: successTitle, type: "success" });
    }
  }, [state, router, successTitle]);

  return (
    <form action={editing ? updateAction : createAction} className="flex flex-col gap-3">
      {editing ? (
        <input type="hidden" name="variableId" value={editing.id} />
      ) : null}
      <Field>
        <FieldLabel htmlFor="price-variable-name">Name</FieldLabel>
        <Input
          id="price-variable-name"
          name="name"
          defaultValue={editing?.name}
          placeholder="e.g. GST"
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="price-variable-value">Value</FieldLabel>
          <Input
            id="price-variable-value"
            name="value"
            type="number"
            step="any"
            defaultValue={editing?.value}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="price-variable-type">Type</FieldLabel>
          <Select
            name="valueType"
            defaultValue={editing?.valueType ?? "number"}
            items={TYPE_LABELS}
          >
            <SelectTrigger id="price-variable-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICE_VARIABLE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Add variable"}
        </Button>
        {editing ? (
          <Button type="button" variant="outline" size="sm" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function VariableRow({
  variable,
  currency,
  onEdit,
}: {
  variable: PriceVariable;
  currency: Currency;
  onEdit: (variable: PriceVariable) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deletePriceVariable, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      toastManager.add({ title: `${variable.name} deleted`, type: "success" });
    }
  }, [state, router, variable.name]);

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-2">
        <p className="text-xs text-muted-foreground">
          Delete &ldquo;{variable.name}&rdquo;?
        </p>
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="variableId" value={variable.id} />
          <Button type="submit" variant="destructive" size="sm" disabled={pending}>
            {pending ? "Deleting…" : "Confirm"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </form>
        {state && "error" in state ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{variable.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatVariableValue(variable, currency)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="pill pill-neutral">{TYPE_LABELS[variable.valueType]}</span>
        <button
          type="button"
          onClick={() => onEdit(variable)}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 hover:bg-muted hover:text-foreground"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md px-2 py-1 text-xs font-medium text-destructive ring-1 ring-destructive/30 hover:bg-destructive/10"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/**
 * The Price Settings tab's right-hand (30%) panel — add/edit/delete named
 * variables, shared across both the Retail and Wholesale formulas, since
 * price_variables isn't scoped to a formula_type. See PriceFormulaBuilder
 * for the left-hand (70%) chain builder this sits beside. No longer needs
 * to know anything about either formula's own state — the chain builder
 * resolves a variable's live name/value straight from the same `variables`
 * list this panel edits, so there's no "is this variable in use right now"
 * concept to track here the way the earlier graph canvas needed.
 */
export function PriceVariablesPanel({
  variables,
  currency,
}: {
  variables: PriceVariable[];
  currency: Currency;
}) {
  const [editing, setEditing] = useState<PriceVariable | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-section-title">Variables</h2>
        <p className="text-caption">
          Named values your formulas can use — e.g. &ldquo;CGST&rdquo; = 12,
          percentage.
        </p>
      </div>

      <VariableForm key={editing?.id ?? "new"} editing={editing} onDone={() => setEditing(null)} />

      {variables.length === 0 ? (
        <p className="text-caption">No variables yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {variables.map((variable) => (
            <VariableRow
              key={variable.id}
              variable={variable}
              currency={currency}
              onEdit={setEditing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
