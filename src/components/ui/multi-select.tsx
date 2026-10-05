"use client";

import { useRef, type KeyboardEvent } from "react";
import { ChevronDownIcon, CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type MultiSelectOption = { id: string; label: string };

/**
 * A Select-styled trigger (literally the `.select` class, so its height/
 * radius/padding are the exact same tokens — --control-height/--control-
 * padding-x — the Role select reads) that opens a popover checkbox
 * listbox instead of a single-pick menu. One shared component for every
 * "pick N of these" control in the app (Team's invite row and the member
 * table's per-row location editor both use this — see team-management.tsx)
 * rather than a bespoke popover+checkboxes pairing per call site.
 *
 * role="listbox"/aria-multiselectable + role="option"/aria-selected per
 * row, with ArrowUp/ArrowDown/Home/End moving focus between options and
 * Space/Enter toggling the focused one — the standard multi-select
 * listbox keyboard pattern. Each option is a single focusable element
 * (not a nested interactive control) with a purely decorative checkbox
 * glyph, so there's exactly one thing per row for a screen reader or the
 * keyboard to land on.
 */
export function MultiSelect({
  idPrefix,
  options,
  selectedIds,
  onToggle,
  placeholder = "Choose…",
  triggerClassName,
  disabled,
}: {
  idPrefix: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  placeholder?: string;
  triggerClassName?: string;
  disabled?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // First 2 selected names directly, "+N" for the rest — same display
  // convention as the member table's own location chips (LocationsCell,
  // team-management.tsx), so a collapsed trigger and an expanded chip
  // list never disagree about how much to show inline.
  const selectedLabels = options
    .filter((o) => selectedIds.includes(o.id))
    .map((o) => o.label);
  const shown = selectedLabels.slice(0, 2);
  const extra = selectedLabels.length - shown.length;
  const triggerText =
    selectedLabels.length === 0
      ? placeholder
      : shown.join(", ") + (extra > 0 ? ` +${extra}` : "");

  function focusOption(index: number) {
    const options = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    options?.[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const optionEls = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []
    );
    const currentIndex = optionEls.findIndex((el) => el === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(Math.min(currentIndex + 1, optionEls.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(Math.max(currentIndex - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(optionEls.length - 1);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      const option = options[currentIndex];
      if (option) onToggle(option.id, !selectedIds.includes(option.id));
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "select select-none justify-between text-left disabled:pointer-events-none disabled:opacity-50",
          triggerClassName
        )}
      >
        <span
          className={cn(
            "truncate",
            selectedLabels.length === 0 && "text-muted-foreground"
          )}
        >
          {triggerText}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <div
          ref={listRef}
          role="listbox"
          aria-multiselectable="true"
          aria-label="Locations"
          className="flex max-h-64 flex-col gap-0.5 overflow-y-auto"
          onKeyDown={handleKeyDown}
        >
          {options.map((option) => {
            const checked = selectedIds.includes(option.id);
            return (
              <div
                key={option.id}
                id={`${idPrefix}-${option.id}`}
                role="option"
                aria-selected={checked}
                tabIndex={0}
                onClick={() => onToggle(option.id, !checked)}
                className="dropdown-item flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-hidden select-none"
              >
                <span
                  className="checkbox"
                  data-checked={checked || undefined}
                  aria-hidden="true"
                >
                  {checked ? <CheckIcon className="size-3.5" /> : null}
                </span>
                {option.label}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
