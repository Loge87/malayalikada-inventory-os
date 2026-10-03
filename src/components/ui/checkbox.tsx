"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // .checkbox (ui.css) carries the shape/border/checked/focus
        // states; the enlarged invisible tap target (after:), the
        // field-label-focus interactions, and the invalid state stay as
        // Tailwind utilities since they're specific to this one component.
        // after:content-[''] is required for the after: pseudo-element to
        // generate at all (CSS `content` defaults to `normal`, which means
        // "no box") — it was missing here, so the enlarged -inset-x-3/
        // -inset-y-3 tap target was never actually rendering; every
        // checkbox in the app (not just Team's) was click-only on its
        // literal 1rem/1.125rem box until this fix.
        // border-brand-accent/bg-brand-accent here (not -primary) — a
        // checked checkbox is a selection state, not an action button;
        // --primary is monochrome and reserved for .btn-primary now.
        "checkbox peer group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:content-[''] after:absolute after:-inset-x-3 after:-inset-y-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-brand-accent dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 group-has-[:focus-visible]/field-label:data-checked:border-brand-accent dark:data-checked:bg-brand-accent",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
