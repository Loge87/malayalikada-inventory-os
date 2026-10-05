"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Currency } from "@/app/(app)/products/constants";
import {
  describeChain,
  FORMULA_START_LABEL,
  type FormulaChain,
  type FormulaType,
} from "@/lib/price-formula";
import { PriceFormulaChain } from "@/components/settings/price-formula-chain";
import {
  PriceVariablesPanel,
  type PriceVariable,
} from "@/components/settings/price-variables-panel";

const CARD_TITLE: Record<FormulaType, string> = {
  retail: "Retail price",
  wholesale: "Wholesale price",
};

type FormulaCardStatus = "not_set" | "applied" | "draft_changes";

const STATUS_LABEL: Record<FormulaCardStatus, string> = {
  not_set: "Not set",
  applied: "Applied",
  draft_changes: "Draft changes",
};

// Reuses the app's existing status-pill color vocabulary (ui.css's
// .pill-success/-warning/-neutral — same classes StockStatusPill uses) so
// "Applied" reads as the same kind of "healthy/settled" green everywhere
// else that color means that, rather than inventing a one-off badge style.
const STATUS_PILL_CLASS: Record<FormulaCardStatus, string> = {
  not_set: "pill-neutral",
  applied: "pill-success",
  draft_changes: "pill-warning",
};

function formulaCardStatus(
  activeChain: FormulaChain | null,
  liveDraftChain: FormulaChain
): FormulaCardStatus {
  if (activeChain === null) return "not_set";
  // Plain structural chains (kind/operator/variableId/nested chain only —
  // see lib/price-formula.ts), always built the same way, so JSON.stringify
  // is a safe, deterministic equality check here, not just a hash.
  return JSON.stringify(activeChain) === JSON.stringify(liveDraftChain)
    ? "applied"
    : "draft_changes";
}

/**
 * One selectable card in the Retail/Wholesale radio group — title, a
 * live one-line formula preview, and a status badge. role="radio" (not a
 * native <input type="radio">, so it can be styled as a full card) inside
 * the parent's role="radiogroup"; keyboard arrow navigation is handled by
 * the parent via onKeyDown, roving tabindex here (tabIndex 0 only when
 * selected — the standard WAI-ARIA radiogroup pattern, so Tab moves focus
 * past the whole group in one stop and arrow keys move within it).
 */
function FormulaSelectorCard({
  formulaType,
  selected,
  previewText,
  status,
  onSelect,
  cardRef,
}: {
  formulaType: FormulaType;
  selected: boolean;
  previewText: string;
  status: FormulaCardStatus;
  onSelect: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={cardRef}
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className="selector-card"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          {/* The radio dot — selection is carried by this PLUS the card's
              own ring (ui.css's [aria-checked="true"]), never by color
              alone. aria-hidden since role="radio"/aria-checked on the
              parent already announce the state to assistive tech. */}
          <span className="selector-card-dot" aria-hidden="true" />
          {CARD_TITLE[formulaType]}
        </span>
        <span className={cn("pill", STATUS_PILL_CLASS[status])}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p
        className="truncate font-mono text-xs text-muted-foreground"
        title={previewText}
      >
        {previewText}
      </p>
    </div>
  );
}

/**
 * The Price Settings tab's 70/30 split — chain builder (left) + variable
 * management (right). Two formulas, Retail and Wholesale, picked via the
 * selector cards just above the split. The variables panel (right) is
 * shared between both formulas (not scoped to a formula_type), so it never
 * changes when switching between them.
 *
 * Both PriceFormulaChain instances stay mounted at all times (toggled with
 * a plain `hidden` attribute, not conditional rendering) — each has its own
 * in-flight debounced autosave; unmounting on selection-switch would tear
 * down a pending save before it fires. This was previously Base UI's
 * TabsPanel `keepMounted`; the selector cards replaced the tab mechanism
 * itself, but the same mount-both-hide-one requirement still applies.
 */
export function PriceFormulaBuilder({
  variables,
  currency,
  retailChain,
  wholesaleChain,
  activeRetailChain,
  activeWholesaleChain,
}: {
  variables: PriceVariable[];
  currency: Currency;
  retailChain: FormulaChain;
  wholesaleChain: FormulaChain;
  activeRetailChain: FormulaChain | null;
  activeWholesaleChain: FormulaChain | null;
}) {
  const [activeFormula, setActiveFormula] = useState<FormulaType>("retail");

  // Mirrors each PriceFormulaChain's own live (draft) state, purely for
  // this component's preview text + status badge — see PriceFormulaChain's
  // onChainChange prop comment. Seeded from the same initial chains so the
  // very first render's preview matches the canvas before any edit.
  const [liveRetailChain, setLiveRetailChain] = useState<FormulaChain>(retailChain);
  const [liveWholesaleChain, setLiveWholesaleChain] =
    useState<FormulaChain>(wholesaleChain);

  const cardRefs = useRef<Record<FormulaType, HTMLDivElement | null>>({
    retail: null,
    wholesale: null,
  });

  function selectAndFocus(type: FormulaType) {
    setActiveFormula(type);
    cardRefs.current[type]?.focus();
  }

  // Exactly two options, so arrow navigation is just "the other one" —
  // Left/Up and Right/Down both move focus+selection to whichever card
  // isn't currently active, matching the standard WAI-ARIA radiogroup
  // keyboard pattern (arrow keys both select AND move focus together).
  function handleKeyDown(event: KeyboardEvent) {
    if (
      event.key === "ArrowRight" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp"
    ) {
      event.preventDefault();
      selectAndFocus(activeFormula === "retail" ? "wholesale" : "retail");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label="Formula to edit"
        onKeyDown={handleKeyDown}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <FormulaSelectorCard
          formulaType="retail"
          selected={activeFormula === "retail"}
          previewText={describeChain(
            FORMULA_START_LABEL.retail,
            liveRetailChain,
            variables
          )}
          status={formulaCardStatus(activeRetailChain, liveRetailChain)}
          onSelect={() => selectAndFocus("retail")}
          cardRef={(el) => {
            cardRefs.current.retail = el;
          }}
        />
        <FormulaSelectorCard
          formulaType="wholesale"
          selected={activeFormula === "wholesale"}
          previewText={describeChain(
            FORMULA_START_LABEL.wholesale,
            liveWholesaleChain,
            variables
          )}
          status={formulaCardStatus(activeWholesaleChain, liveWholesaleChain)}
          onSelect={() => selectAndFocus("wholesale")}
          cardRef={(el) => {
            cardRefs.current.wholesale = el;
          }}
        />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Card className="flex-1 overflow-hidden lg:basis-[70%]">
          <CardContent>
            <div hidden={activeFormula !== "retail"}>
              <PriceFormulaChain
                formulaType="retail"
                initialChain={retailChain}
                variables={variables}
                currency={currency}
                onChainChange={setLiveRetailChain}
              />
            </div>
            <div hidden={activeFormula !== "wholesale"}>
              <PriceFormulaChain
                formulaType="wholesale"
                initialChain={wholesaleChain}
                variables={variables}
                currency={currency}
                onChainChange={setLiveWholesaleChain}
              />
            </div>
          </CardContent>
        </Card>
        <Card className="lg:basis-[30%]">
          <CardContent>
            <PriceVariablesPanel variables={variables} currency={currency} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
