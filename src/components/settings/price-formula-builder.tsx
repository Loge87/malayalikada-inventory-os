"use client";

import { CurrencyPanel } from "@/components/settings/currency-panel";
import { ShipmentCostPanel } from "@/components/settings/shipment-cost-panel";
import type { ShipmentCosts } from "@/lib/price-formula";
import { useRef, useState, type KeyboardEvent } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Currency } from "@/app/(app)/products/constants";
import {
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
 * One segment of the Retail/Wholesale toggle — title plus a small status
 * dot. role="radio" inside the parent's role="radiogroup"; keyboard arrow
 * navigation is handled by the parent via onKeyDown, roving tabindex here
 * (tabIndex 0 only when selected — the standard WAI-ARIA radiogroup
 * pattern).
 */
const STATUS_DOT_CLASS: Record<FormulaCardStatus, string> = {
  not_set: "bg-muted-foreground/40",
  applied: "bg-status-success",
  draft_changes: "bg-status-warning",
};

function FormulaToggleButton({
  formulaType,
  selected,
  status,
  onSelect,
  cardRef,
}: {
  formulaType: FormulaType;
  selected: boolean;
  status: FormulaCardStatus;
  onSelect: () => void;
  cardRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={cardRef}
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/10"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {CARD_TITLE[formulaType]}
      <span
        className={cn("size-2 rounded-full", STATUS_DOT_CLASS[status])}
        title={STATUS_LABEL[status]}
        aria-label={STATUS_LABEL[status]}
      />
    </button>
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
  shipmentCosts,
}: {
  shipmentCosts: ShipmentCosts;
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

  const cardRefs = useRef<Record<FormulaType, HTMLButtonElement | null>>({
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="radiogroup"
          aria-label="Formula to edit"
          onKeyDown={handleKeyDown}
          className="inline-flex w-fit gap-1 rounded-full bg-muted p-1"
        >
          <FormulaToggleButton
            formulaType="retail"
            selected={activeFormula === "retail"}
            status={formulaCardStatus(activeRetailChain, liveRetailChain)}
            onSelect={() => selectAndFocus("retail")}
            cardRef={(el) => {
              cardRefs.current.retail = el;
            }}
          />
          <FormulaToggleButton
            formulaType="wholesale"
            selected={activeFormula === "wholesale"}
            status={formulaCardStatus(activeWholesaleChain, liveWholesaleChain)}
            onSelect={() => selectAndFocus("wholesale")}
            cardRef={(el) => {
              cardRefs.current.wholesale = el;
            }}
          />
        </div>
        <CurrencyPanel currency={currency} />
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Card className="flex-1 overflow-hidden lg:basis-[68%]">
          <CardContent>
            <div hidden={activeFormula !== "retail"}>
              <PriceFormulaChain
                formulaType="retail"
                initialChain={retailChain}
                variables={variables}
                currency={currency}
                shipmentCosts={shipmentCosts}
                onChainChange={setLiveRetailChain}
              />
            </div>
            <div hidden={activeFormula !== "wholesale"}>
              <PriceFormulaChain
                formulaType="wholesale"
                initialChain={wholesaleChain}
                variables={variables}
                currency={currency}
                shipmentCosts={shipmentCosts}
                onChainChange={setLiveWholesaleChain}
              />
            </div>
          </CardContent>
        </Card>

        {/* Right panel stays put when the toggle above switches. */}
        <div className="flex flex-col gap-5 lg:basis-[32%]">
          <Card>
            <CardContent>
              <PriceVariablesPanel variables={variables} currency={currency} />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <ShipmentCostPanel costs={shipmentCosts} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
