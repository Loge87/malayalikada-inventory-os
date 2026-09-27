"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type ComboboxOption = { value: string; label: string }

/**
 * A single-select searchable dropdown — Select's counterpart for when the
 * option list is long enough that typing to filter matters more than a
 * fixed list (Stock Out's Location/Client pickers). `items` matches
 * Select's own Record<string,string> convention (value -> label) so the two
 * read as the same family of control, styled to match (rounded-lg border
 * border-input, bg-popover ring-1 ring-foreground/10 popup).
 */
function Combobox({
  items,
  value,
  onValueChange,
  placeholder,
  id,
  disabled,
  emptyMessage = "No matches",
  className,
}: {
  items: Record<string, string>
  value: string | null
  onValueChange: (value: string | null) => void
  placeholder?: string
  id?: string
  disabled?: boolean
  emptyMessage?: string
  className?: string
}) {
  const options: ComboboxOption[] = React.useMemo(
    () => Object.entries(items).map(([value, label]) => ({ value, label })),
    [items]
  )
  const selected = value != null ? (options.find((o) => o.value === value) ?? null) : null

  return (
    <ComboboxPrimitive.Root
      items={options}
      value={selected}
      onValueChange={(next) => onValueChange(next ? next.value : null)}
      isItemEqualToValue={(a: ComboboxOption, b: ComboboxOption) => a.value === b.value}
      disabled={disabled}
    >
      <ComboboxPrimitive.InputGroup
        className={cn(
          "relative flex h-10 w-full items-center rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/80 sm:h-8 dark:bg-input/30",
          className
        )}
      >
        <ComboboxPrimitive.Input
          id={id}
          placeholder={placeholder}
          className="h-full w-full min-w-0 rounded-lg bg-transparent pl-2.5 pr-14 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="absolute right-1 flex items-center gap-0.5">
          <ComboboxPrimitive.Clear
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear selection"
          >
            <XIcon className="size-3.5" />
          </ComboboxPrimitive.Clear>
          <ComboboxPrimitive.Trigger
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Open"
          >
            <ChevronDownIcon className="size-4" />
          </ComboboxPrimitive.Trigger>
        </div>
      </ComboboxPrimitive.InputGroup>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner className="isolate z-50" sideOffset={4}>
          <ComboboxPrimitive.Popup className="max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <ComboboxPrimitive.Empty className="px-2.5 py-2 text-sm text-muted-foreground">
              {emptyMessage}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="p-1">
              {(item: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  className="relative flex cursor-default items-center gap-1.5 rounded-md py-2 pr-8 pl-2.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="flex-1 truncate">{item.label}</span>
                  <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
                    <CheckIcon className="size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}

export { Combobox }
