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

export type SettingsTab = "general" | "price-settings" | "notifications";

/**
 * Pure client state, not a `router.push`-driven URL change — same reasoning
 * as StockOutTabs: /settings/page.tsx fetches every tab's data unconditionally
 * on load, so switching tabs here never needs a server round trip. The
 * address bar still updates (via history.replaceState, not Next's router) so
 * a reloaded/shared link lands on the right tab — cosmetic only.
 */
export function SettingsTabs({
  activeTab: initialTab,
  generalContent,
  priceSettingsContent,
  notificationsContent,
}: {
  activeTab: SettingsTab;
  generalContent: ReactNode;
  priceSettingsContent: ReactNode;
  notificationsContent: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  function handleTabChange(value: unknown) {
    if (
      value !== "general" &&
      value !== "price-settings" &&
      value !== "notifications"
    ) {
      return;
    }
    setActiveTab(value);

    const next = new URLSearchParams(searchParams.toString());
    if (value === "general") next.delete("tab");
    else next.set("tab", value);
    const query = next.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTab value="general">General</TabsTab>
        <TabsTab value="price-settings">Price Settings</TabsTab>
        <TabsTab value="notifications">Notifications</TabsTab>
        <TabsIndicator />
      </TabsList>
      <TabsPanel value="general" className="pt-3 sm:pt-4">
        {generalContent}
      </TabsPanel>
      <TabsPanel value="price-settings" className="pt-3 sm:pt-4">
        {priceSettingsContent}
      </TabsPanel>
      <TabsPanel value="notifications" className="pt-3 sm:pt-4">
        {notificationsContent}
      </TabsPanel>
    </Tabs>
  );
}
