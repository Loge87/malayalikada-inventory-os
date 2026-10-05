"use client";

import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

import {
  describeChain,
  FORMULA_RESULT_LABEL,
  FORMULA_START_LABEL,
  MAX_GROUP_DEPTH,
  OPERATOR_COLOR_CLASS,
  OPERATOR_KINDS,
  OPERATOR_LABELS,
  OPERATOR_SYMBOLS,
  type ChainStep,
  type FormulaChain,
  type FormulaType,
  type GroupStep,
  type OperatorKind,
} from "@/lib/price-formula";
import { cn } from "@/lib/utils";
import {
  applyPriceFormula,
  savePriceFormula,
} from "@/app/(app)/settings/price-formula-actions";
import {
  formatVariableValue,
  type PriceVariable,
} from "@/lib/price-variable-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toastManager } from "@/components/ui/toast";

/** How long to wait, after the last change, before persisting — a short
 *  debounce collapses a burst of quick edits (e.g. picking a variable then
 *  immediately changing its operator) into one write, same reasoning as
 *  the earlier graph canvas's autosave. Always editing the DRAFT (Stage
 *  A/B) — nothing here has a real-world side effect to be cautious about,
 *  so autosave over an explicit Save button is still the right call. */
const AUTOSAVE_DEBOUNCE_MS = 800;
const SAVED_INDICATOR_MS = 2000;

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span className="text-caption">
      {status === "saving"
        ? "Saving…"
        : status === "saved"
          ? "Saved"
          : "Save failed — will retry on the next change"}
    </span>
  );
}

/** The thin horizontal line between two boxes — an operator circle (when
 *  `operator` is given) sits directly on top of it, centered, matching the
 *  reference design: the operator is part of the connecting line, not a
 *  separate node floating beside it. */
function Connector({
  operator,
  onChangeOperator,
}: {
  operator?: OperatorKind;
  onChangeOperator?: (operator: OperatorKind) => void;
}) {
  return (
    <div className="relative flex w-10 shrink-0 items-center sm:w-14">
      <div className="h-px w-full bg-border" />
      {operator ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                title={OPERATOR_LABELS[operator]}
                aria-label={`Change operator (currently ${OPERATOR_LABELS[operator]})`}
                className={cn(
                  "absolute left-1/2 flex size-7 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-card text-sm font-bold shadow-card",
                  OPERATOR_COLOR_CLASS[operator]
                )}
              />
            }
          >
            {OPERATOR_SYMBOLS[operator]}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {OPERATOR_KINDS.map((kind) => (
              <DropdownMenuItem key={kind} onClick={() => onChangeOperator?.(kind)}>
                <span className={cn("w-4 text-center font-bold", OPERATOR_COLOR_CLASS[kind])}>
                  {OPERATOR_SYMBOLS[kind]}
                </span>
                {OPERATOR_LABELS[kind]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

/** The fixed starting box — "Unit Price" / "Pack/Box Price" — visually
 *  distinct from a variable box (brand-tinted, not removable, no delete
 *  affordance) since it isn't a user choice the way every box after it is. */
function StartBox({ label }: { label: string }) {
  return (
    <div className="flex min-w-28 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-brand-accent bg-brand-accent-tint px-3 py-2 text-center">
      {/* text-foreground (plain body text), not text-brand-accent or
          text-brand-accent-foreground — this box's background is a pale
          TINT of the brand color, not a solid fill, and neither brand
          token reads reliably on a tint in both themes (the raw accent
          measures ~1.5:1 on its own light-mode tint; the fixed dark
          brand-accent-foreground measures ~1.4:1 on the dark-mode tint,
          which composites dark, not pale, over the dark card). Plain
          --foreground is correct in both modes regardless of the brand
          hue — see --sidebar-active-foreground's comment in theme.css for
          the full numbers. The colored border + tint already carry the
          "this is branded" signal; the text just needs to be legible. */}
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </div>
  );
}

/** One variable box — name + current value, e.g. "CGST" / "12%" — with a
 *  small delete affordance to remove this step from the chain entirely
 *  (not explicitly in the reference design, but there'd be no way to
 *  undo adding one otherwise). A step whose variable has since been
 *  deleted still renders (so the chain's actual length never silently
 *  changes underneath the user), labelled plainly as missing. */
function VariableBox({
  variable,
  currency,
  onRemove,
}: {
  variable: PriceVariable | undefined;
  currency: string;
  onRemove: () => void;
}) {
  return (
    <div className="relative flex min-w-28 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-center shadow-card">
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${variable?.name ?? "this step"}`}
        className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3" />
      </button>
      {variable ? (
        <>
          <span className="truncate text-sm font-medium">{variable.name}</span>
          <span className="text-caption">{formatVariableValue(variable, currency)}</span>
        </>
      ) : (
        <span className="text-caption text-destructive">Deleted variable</span>
      )}
    </div>
  );
}

/** A GROUP step — a shaded, bordered container sitting inline in the chain
 *  exactly like a variable box, holding its own nested ChainRow. Visually
 *  contained (background + border) but built from the exact same
 *  box/connector primitives as the parent, per the reference image: a
 *  group isn't a different kind of canvas, just a bounded region of the
 *  same one. */
function GroupBox({
  step,
  variables,
  currency,
  depth,
  onRemove,
  onChangeChain,
}: {
  step: GroupStep;
  variables: PriceVariable[];
  currency: string;
  depth: number;
  onRemove: () => void;
  onChangeChain: (chain: FormulaChain) => void;
}) {
  return (
    <div className="relative shrink-0 rounded-xl border border-dashed border-border bg-muted/50 px-2 py-2">
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove group"
        className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3" />
      </button>
      <ChainRow
        steps={step.chain}
        onChange={onChangeChain}
        variables={variables}
        currency={currency}
        depth={depth}
      />
    </div>
  );
}

/** The trailing control — opens a menu to either append the next saved
 *  variable, or append a new empty group, as the next step. "Add group" is
 *  hidden once nesting has reached MAX_GROUP_DEPTH, so the canvas can't
 *  grow groups-within-groups-within-groups. Lists ALL variables every time
 *  (not just ones unused so far) — reusing the same variable twice in one
 *  formula isn't invalid, just unusual, so nothing here forbids it. */
function AppendMenu({
  variables,
  currency,
  canAddGroup,
  onAppendVariable,
  onAppendGroup,
}: {
  variables: PriceVariable[];
  currency: string;
  canAddGroup: boolean;
  onAppendVariable: (variableId: string) => void;
  onAppendGroup: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Add to this formula"
            // hover:text-foreground, not hover:text-brand-accent — this
            // button has no tint fill, so hover text sits directly on
            // --card; the raw accent reads fine on the dark card (10.99:1)
            // but fails badly on the light-mode white card (1.57:1). The
            // colored border already signals "hovered."
            className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground hover:border-brand-accent hover:text-foreground"
          />
        }
      >
        <Plus className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {canAddGroup ? (
          <>
            <DropdownMenuItem onClick={onAppendGroup}>
              Add group
              <span className="ml-auto text-xs text-muted-foreground">( … )</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {variables.length === 0 ? (
          <DropdownMenuItem disabled>No variables yet — add one on the right</DropdownMenuItem>
        ) : (
          variables.map((variable) => (
            <DropdownMenuItem key={variable.id} onClick={() => onAppendVariable(variable.id)}>
              {variable.name}
              <span className="ml-auto text-xs text-muted-foreground">
                {formatVariableValue(variable, currency)}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Renders one level of a chain — the top-level formula (depth 0, with a
 * fixed StartBox) or a group's own nested chain (depth >= 1, no StartBox;
 * its first step is the seed instead, shown with no leading connector
 * since nothing precedes it to combine with). Purely controlled: owns no
 * state of its own, so a change anywhere — including deep inside a nested
 * group — bubbles straight up to the top-level `chain` state via immutable
 * replacement at each level, which is what the single top-level autosave
 * effect watches.
 */
type RowBreak = { lineTop: number; lineBottom: number; stubY: number; stubWidth: number };

/**
 * Flexbox has no way to ask "which items landed on the same wrapped line" —
 * CSS alone can't target a wrap boundary. This measures each top-level
 * unit's position after layout (and on resize) and derives one RowBreak per
 * wrap point: a vertical line down the chain's left edge, confined strictly
 * to the empty gap between rows (previous row's bottom to next row's TOP —
 * never into either row's own vertical extent), plus a short horizontal
 * stub at that same top edge into wherever the next row's first box
 * actually starts (0 in the normal case, so the stub is invisible and only
 * the vertical line shows). Earlier this ran down to the new row's
 * vertical CENTER instead, which put it right through that row's own
 * operator circle and box text — confining it to the gap means it can
 * never geometrically overlap a box no matter where it's drawn.
 *
 * Reads the live DOM directly off containerRef (data-wrap-unit="true"
 * marks each top-level unit, the overlay connectors below are excluded by
 * the same marker's absence) rather than collecting element refs into a
 * parallel array — a plain array mutated by ref callbacks after render
 * trips react-hooks/immutability (render output is meant to be treated as
 * immutable); a DOM ref read inside an effect is the sanctioned escape
 * hatch for exactly this.
 */
function useRowBreaks(
  containerRef: RefObject<HTMLDivElement | null>,
  watch: unknown
): RowBreak[] {
  const [breaks, setBreaks] = useState<RowBreak[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measure() {
      const containerEl = containerRef.current;
      if (!containerEl) {
        setBreaks([]);
        return;
      }
      const units = Array.from(containerEl.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el.dataset.wrapUnit === "true"
      );
      if (units.length < 2) {
        setBreaks([]);
        return;
      }
      const containerBox = containerEl.getBoundingClientRect();
      const rects = units.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          top: r.top - containerBox.top,
          left: r.left - containerBox.left,
          bottom: r.bottom - containerBox.top,
        };
      });

      type Row = { top: number; bottom: number; firstLeft: number };
      const rows: Row[] = [];
      for (const r of rects) {
        const currentRow = rows[rows.length - 1];
        if (currentRow && Math.abs(r.top - currentRow.top) <= 2) {
          currentRow.bottom = Math.max(currentRow.bottom, r.bottom);
        } else {
          rows.push({ top: r.top, bottom: r.bottom, firstLeft: r.left });
        }
      }

      const next: RowBreak[] = [];
      for (let i = 1; i < rows.length; i++) {
        next.push({
          lineTop: rows[i - 1].bottom,
          lineBottom: rows[i].top,
          stubY: rows[i].top,
          stubWidth: rows[i].firstLeft,
        });
      }
      setBreaks(next);
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
    // `watch` (ChainRow passes `steps`) forces a re-measure on every
    // content change (append/remove/operator change), on top of the
    // ResizeObserver catching pure width changes from window resizing.
  }, [containerRef, watch]);

  return breaks;
}

function ChainRow({
  steps,
  onChange,
  variables,
  currency,
  depth,
  startLabel,
}: {
  steps: FormulaChain;
  onChange: (next: FormulaChain) => void;
  variables: PriceVariable[];
  currency: string;
  depth: number;
  startLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  function updateStep(index: number, next: ChainStep) {
    onChange(steps.map((step, i) => (i === index ? next : step)));
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }

  function appendVariable(variableId: string) {
    onChange([...steps, { kind: "variable", operator: "add", variableId }]);
  }

  function appendGroup() {
    onChange([...steps, { kind: "group", operator: "add", chain: [] }]);
  }

  function renderBox(step: ChainStep, index: number) {
    if (step.kind === "group") {
      return (
        <GroupBox
          step={step}
          variables={variables}
          currency={currency}
          depth={depth + 1}
          onRemove={() => removeStep(index)}
          onChangeChain={(chain) => updateStep(index, { ...step, chain })}
        />
      );
    }
    return (
      <VariableBox
        variable={variables.find((v) => v.id === step.variableId)}
        currency={currency}
        onRemove={() => removeStep(index)}
      />
    );
  }

  const hasFixedStart = startLabel !== undefined;
  // Inside a group there's no fixed start — the chain's own first entry is
  // the seed, rendered with no leading connector/operator (nothing precedes
  // it). At the top level, StartBox plays that role instead, so every
  // entry in `steps` gets a connector.
  const seedIndex = !hasFixedStart && steps.length > 0 ? 0 : -1;
  const connectedSteps = seedIndex === 0 ? steps.slice(1) : steps;
  const connectedOffset = seedIndex === 0 ? 1 : 0;

  const rowBreaks = useRowBreaks(containerRef, steps);

  return (
    <div ref={containerRef} className="relative flex flex-wrap items-center gap-y-6">
      {hasFixedStart ? (
        <div data-wrap-unit="true">
          <StartBox label={startLabel} />
        </div>
      ) : null}
      {seedIndex === 0 ? (
        <div data-wrap-unit="true" className="flex items-center">
          {renderBox(steps[0], 0)}
        </div>
      ) : null}
      {connectedSteps.map((step, i) => {
        const index = i + connectedOffset;
        return (
          <div key={index} data-wrap-unit="true" className="flex items-center">
            <Connector
              operator={step.operator}
              onChangeOperator={(operator) => updateStep(index, { ...step, operator })}
            />
            {renderBox(step, index)}
          </div>
        );
      })}
      <div data-wrap-unit="true" className="flex items-center">
        <Connector />
        <AppendMenu
          variables={variables}
          currency={currency}
          canAddGroup={depth < MAX_GROUP_DEPTH}
          onAppendVariable={appendVariable}
          onAppendGroup={appendGroup}
        />
      </div>

      {/* Wrap connectors — a vertical "continues" line down the chain's
          left edge at each row break, plus a short horizontal stub into
          the next row's first box (invisible when that box starts flush
          left, which is the normal case). Confined to the empty row gap
          (see useRowBreaks) so it can't geometrically reach a box's text —
          -z-10 is belt-and-suspenders on top of that: any positioned
          absolute element placed later in the DOM (which these are, as the
          container's last children) paints ABOVE normal-flow content
          regardless of DOM order otherwise, exactly what put these lines
          visibly over the boxes/operator circles before. Negative z-index
          drops them below the container's own normal-flow children (the
          unit boxes) while staying above the container's plain background. */}
      {rowBreaks.map((b, i) => (
        <div key={i} aria-hidden className="pointer-events-none absolute left-0 -z-10" style={{ top: b.lineTop, width: 2, height: Math.max(b.lineBottom - b.lineTop, 0) }}>
          <div className="h-full w-full bg-border" />
        </div>
      ))}
      {rowBreaks.map((b, i) => (
        <div
          key={`stub-${i}`}
          aria-hidden
          className="pointer-events-none absolute left-0 -z-10 h-0.5 bg-border"
          style={{ top: b.stubY, width: b.stubWidth }}
        />
      ))}
    </div>
  );
}

/**
 * "Apply Changes" — the only thing that moves the DRAFT (whatever's been
 * autosaved above) into ACTIVE, which is what every real product's
 * displayed price actually reads. Confirmation copy names the formula
 * type and the scope of the effect explicitly, since this is the one
 * action in this whole builder with a real-world consequence — everything
 * else here only ever touches the draft.
 */
function ApplyChangesButton({ formulaType }: { formulaType: FormulaType }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const resultLabel = FORMULA_RESULT_LABEL[formulaType];
  const typeLabel = formulaType === "retail" ? "Retail" : "Wholesale";

  async function handleConfirm() {
    setPending(true);
    setError(null);
    const result = await applyPriceFormula(formulaType);
    setPending(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setOpen(false);
    router.refresh();
    toastManager.add({ title: `${resultLabel} formula applied`, type: "success" });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        Apply Changes
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply {typeLabel} changes?</DialogTitle>
          <DialogDescription>
            This will update {typeLabel} pricing for every product in your
            catalog using this formula. Continue?
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={pending}>
            {pending ? "Applying…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The flat, left-to-right formula chain builder — Retail or Wholesale,
 * picked by the parent (see price-formula-builder.tsx). No canvas library:
 * a chain is just an ordered (possibly nested, via groups) array, rendered
 * as a row of boxes and operator circles via ChainRow, so this stays a
 * plain component, not a graph editor.
 */
export function PriceFormulaChain({
  formulaType,
  initialChain,
  variables,
  currency,
  onChainChange,
}: {
  formulaType: FormulaType;
  initialChain: FormulaChain;
  variables: PriceVariable[];
  currency: string;
  /** Mirrors this chain's live (draft, possibly-unsaved) state up to the
   *  parent — the parent needs it for the Retail/Wholesale selector cards'
   *  one-line preview and Applied/Draft changes/Not set status badge, which
   *  live outside this component and would otherwise have no visibility
   *  into in-progress edits. Purely a read mirror — this component's own
   *  `chain` state stays the single source of truth for editing/autosave. */
  onChainChange?: (chain: FormulaChain) => void;
}) {
  const [chain, setChain] = useState<FormulaChain>(initialChain);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Fires on mount too (so the parent gets the starting value, not just
  // subsequent edits) and on every change thereafter.
  useEffect(() => {
    onChainChange?.(chain);
    // onChainChange intentionally excluded — price-formula-builder.tsx
    // passes a fresh inline closure each render, and including it would
    // re-fire this effect (harmlessly, but needlessly) every render rather
    // than only when `chain` itself actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain]);

  // Debounced autosave — see savePriceFormula's own doc comment for why
  // this is autosave rather than an explicit Save button.
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      // Skip the save that would otherwise fire immediately on mount —
      // `chain` just arrived from the server, there's nothing new yet.
      isFirstRenderRef.current = false;
      return;
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (savedIndicatorTimeoutRef.current) clearTimeout(savedIndicatorTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus("saving");
      savePriceFormula(formulaType, chain).then((result) => {
        if ("error" in result) {
          setSaveStatus("error");
          return;
        }
        setSaveStatus("saved");
        savedIndicatorTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), SAVED_INDICATOR_MS);
      });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [chain, formulaType]);

  const startLabel = FORMULA_START_LABEL[formulaType];
  const previewText = describeChain(startLabel, chain, variables);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-section-title">{FORMULA_RESULT_LABEL[formulaType]}</h2>
        <div className="flex items-center gap-3">
          <SaveStatusIndicator status={saveStatus} />
          <ApplyChangesButton formulaType={formulaType} />
        </div>
      </div>

      <p className="rounded-lg bg-muted px-3 py-2 text-sm">
        <span className="font-medium">{FORMULA_RESULT_LABEL[formulaType]} = </span>
        <span className="font-mono">{previewText}</span>
      </p>

      {/* No nested scroll area — a long or deeply-grouped chain wraps onto
          further lines (ChainRow is flex-wrap) and the container simply
          grows taller. The page itself scrolls once total content exceeds
          the viewport, same as any other tall page — no small internal
          scrollbox trapping the canvas. */}
      <div className="py-6">
        <ChainRow
          steps={chain}
          onChange={setChain}
          variables={variables}
          currency={currency}
          depth={0}
          startLabel={startLabel}
        />
      </div>
    </div>
  );
}
