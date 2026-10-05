"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("tabs relative z-0", className)}
      {...props}
    />
  )
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn("tab relative z-10 select-none", className)}
      {...props}
    />
  )
}

function TabsIndicator({ className, ...props }: TabsPrimitive.Indicator.Props) {
  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      className={cn(
        // bg-tab-active + shadow-(--tab-active-ring) + a 1px border-
        // (--tab-active-border) — CORRECTED: every tab control is now
        // deliberately white/grey/black only (theme.css's TABS group),
        // fully decoupled from --primary/--sidebar-active (both still
        // green). The border is NEW this pass — a decisive edge so the
        // active pill reads as visible even where the fill/track contrast
        // alone is comparatively weak (dark mode), rather than visibility
        // depending on that one number.
        "absolute top-1/2 left-0 z-0 h-8 w-(--active-tab-width) -translate-y-1/2 translate-x-(--active-tab-left) rounded-md border border-(--tab-active-border) bg-tab-active shadow-(--tab-active-ring) transition-[translate,width] duration-(--duration-base) ease-(--ease-out)",
        className
      )}
      {...props}
    />
  )
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel }
