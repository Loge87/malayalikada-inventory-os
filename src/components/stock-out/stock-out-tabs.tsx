"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  Tabs,
  TabsIndicator,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@/components/ui/tabs";

/**
 * Toggles between the scan-and-record flow and the filtered history list.
 * Deliberately pure client state, not a `router.push`-driven URL change —
 * /stock-out/page.tsx is an async Server Component, so ANY searchParams
 * change (even just `?tab=`) forces the whole page to re-render server-side:
 * every switch was paying a full round trip (all the baseline queries plus
 * a fresh history fetch) before the tab's content could update, which is
 * what made switching feel sluggish. page.tsx now fetches both tabs' data
 * unconditionally on every load, so nothing here needs to wait on the
 * network — this component only ever swaps which already-rendered content
 * is visible.
 *
 * The current tab still shows up in the address bar (via
 * history.replaceState, not Next's router) so a copied/reloaded link lands
 * on the right one — that's cosmetic only and never triggers a fetch.
 */
export function StockOutTabs({
  activeTab: initialTab,
  recordContent,
  historyContent,
}: {
  activeTab: "record" | "history";
  recordContent: ReactNode;
  historyContent: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(initialTab);

  function handleTabChange(value: unknown) {
    if (value !== "record" && value !== "history") return;
    setActiveTab(value);

    const next = new URLSearchParams(searchParams.toString());
    if (value === "record") next.delete("tab");
    else next.set("tab", value);
    const query = next.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    // Raw History API, not router.push/replace — updates what's shown in
    // the address bar without asking Next.js to re-render the page.
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTab value="record">Record</TabsTab>
        <TabsTab value="history">History</TabsTab>
        <TabsIndicator />
      </TabsList>
      <TabsPanel value="record" className="pt-4">
        {recordContent}
      </TabsPanel>
      <TabsPanel value="history" className="pt-4">
        {historyContent}
      </TabsPanel>
    </Tabs>
  );
}
