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
        // bg-sidebar-active — CORRECTED from bg-brand-accent (and, before
        // that, bg-primary): the reference image's active tab is a neutral
        // light/near-white pill, not any brand hue. Reuses the exact same
        // token the sidebar's active-nav pill reads (theme.css), since the
        // image treats both identically — one shared "neutral active pill"
        // concept, not a tab-specific color.
        "absolute top-1/2 left-0 z-0 h-8 w-(--active-tab-width) -translate-y-1/2 translate-x-(--active-tab-left) rounded-md bg-sidebar-active shadow-sm transition-[translate,width] duration-150 ease-in-out",
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
