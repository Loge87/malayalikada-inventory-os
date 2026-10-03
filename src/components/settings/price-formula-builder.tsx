"use client";

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsIndicator,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@/components/ui/tabs";
import type { Currency } from "@/app/(app)/products/constants";
import type { FormulaChain, FormulaType } from "@/lib/price-formula";
import { PriceFormulaChain } from "@/components/settings/price-formula-chain";
import {
  PriceVariablesPanel,
  type PriceVariable,
} from "@/components/settings/price-variables-panel";

/**
 * The Price Settings tab's 70/30 split — chain builder (left) + variable
 * management (right). Two formulas, Retail and Wholesale, switched via the
 * sub-tabs just above the split. The variables panel (right) sits OUTSIDE
 * either TabsPanel, as a sibling — it's shared between both formulas (not
 * scoped to a formula_type), so it never changes when switching between
 * them.
 *
 * Unlike the earlier graph canvas, neither side needs to know what the
 * other is doing beyond the plain `variables` list both already receive:
 * PriceFormulaChain resolves every step's live name/value straight from
 * that list on every render (never a stored snapshot), so a variable
 * created, renamed, or deleted in the panel is correctly reflected the
 * next time this re-renders (router.refresh() after any variable edit) —
 * no ref/imperative-handle plumbing between the two needed at all.
 *
 * keepMounted explicitly true on both TabsPanels (same as the earlier
 * graph canvas had) — each chain has its own in-flight debounced autosave;
 * unmounting on tab-switch would tear down a pending save before it fires.
 */
export function PriceFormulaBuilder({
  variables,
  currency,
  retailChain,
  wholesaleChain,
}: {
  variables: PriceVariable[];
  currency: Currency;
  retailChain: FormulaChain;
  wholesaleChain: FormulaChain;
}) {
  const [activeFormula, setActiveFormula] = useState<FormulaType>("retail");

  return (
    <Tabs
      value={activeFormula}
      onValueChange={(value) => {
        if (value === "retail" || value === "wholesale") setActiveFormula(value);
      }}
    >
      {/* TEMPORARY side-by-side comparison for the Retail/Wholesale
          selector — both controls are fully wired to the same
          activeFormula state (two independently-rendered Tabs.Root
          instances sharing one controlled value/onValueChange, a valid
          Base UI pattern), so clicking either one actually switches the
          real panels below and keeps both controls in sync. Remove
          whichever variant isn't picked once reviewed. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-1.5">
          <span className="text-caption">Current (tabs)</span>
          <TabsList>
            <TabsTab value="retail">Retail</TabsTab>
            <TabsTab value="wholesale">Wholesale</TabsTab>
            <TabsIndicator />
          </TabsList>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-caption">Alternative (segmented control)</span>
          <Tabs
            value={activeFormula}
            onValueChange={(value) => {
              if (value === "retail" || value === "wholesale") setActiveFormula(value);
            }}
          >
            <TabsList className="w-56 rounded-full">
              <TabsTab value="retail" className="flex-1 rounded-full">
                Retail
              </TabsTab>
              <TabsTab value="wholesale" className="flex-1 rounded-full">
                Wholesale
              </TabsTab>
              <TabsIndicator className="rounded-full" />
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <Card className="flex-1 overflow-hidden lg:basis-[70%]">
          <CardContent>
            <TabsPanel value="retail" keepMounted>
              <PriceFormulaChain
                formulaType="retail"
                initialChain={retailChain}
                variables={variables}
                currency={currency}
              />
            </TabsPanel>
            <TabsPanel value="wholesale" keepMounted>
              <PriceFormulaChain
                formulaType="wholesale"
                initialChain={wholesaleChain}
                variables={variables}
                currency={currency}
              />
            </TabsPanel>
          </CardContent>
        </Card>
        <Card className="lg:basis-[30%]">
          <CardContent>
            <PriceVariablesPanel variables={variables} currency={currency} />
          </CardContent>
        </Card>
      </div>
    </Tabs>
  );
}
