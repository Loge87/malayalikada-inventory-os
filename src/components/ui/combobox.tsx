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
      {/* CORRECTED this pass — used to be its own hardcoded `h-10 ...
          sm:h-8` + `rounded-lg` Tailwind string, disconnected from
          --control-height/--radius-input entirely (and carrying the
          exact same "sm: utility silently wins over the shared rule"
          shape as the bugs already fixed in button.tsx/select.tsx/
          input.tsx). .combobox-group (ui.css) now reads those tokens
          directly, same as .input/.select — this IS the app's measured
          reference control (see theme.css's --control-height comment),
          so it has to be the one actually built from the tokens, not
          just the one other controls were measured against. */}
      <ComboboxPrimitive.InputGroup
        className={cn("combobox-group relative dark:bg-input/30", className)}
      >
        <ComboboxPrimitive.Input
          id={id}
          placeholder={placeholder}
          // CORRECTED this pass — was h-full: with the group's own height
          // no longer fixed (see .combobox-group's comment), "100% of an
          // auto-height parent" has nothing to resolve against. The input
          // just takes its own natural line-height now, centered within
          // the taller padded group by the group's own align-items: center.
          className="w-full min-w-0 rounded-[var(--radius-input)] bg-transparent pl-(--control-padding-x) pr-14 text-sm outline-none placeholder:text-muted-foreground"
        />
        {/* top-1/2 -translate-y-1/2, explicit — this is position:absolute
            (to sit on top of the input rather than taking its own row), so
            with the group now taller (padding-driven, not a fixed height)
            it needs a real anchor to stay vertically centered rather than
            relying on its pre-absolute "static position" inside the
            flex row, which isn't guaranteed consistent across browsers. */}
        <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
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
