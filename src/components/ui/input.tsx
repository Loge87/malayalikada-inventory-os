import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // .input (ui.css) carries the shape/border/focus/disabled states;
        // the file-input sub-styling, responsive size, and dark-mode
        // background tweaks stay as Tailwind utilities since they're
        // specific to this one component.
        // CORRECTED this pass (item 2): `sm:h-8` used to sit here — a
        // utilities-layer height that WINS over ui.css's own `.input`
        // height for the same longhand property at >=640px (same bug
        // class as button.tsx's old `sm:h-9` and select.tsx's old
        // `sm:data-[size=default]:h-8` — see each of their own comments).
        // This is the one that made .input measure ~32px on desktop while
        // .select/.btn measured 40/36px, three different heights on one
        // row. Removed; height now comes purely from .input's own
        // --control-height.
        // CORRECTED again this pass: `md:text-sm` sat here too — the
        // exact same bug, on font-size instead of height. .input's own
        // font-size (ui.css) was a literal 1rem that this utility beat at
        // >=768px, so the control-height audit's live measurement of
        // every .input on the page read 14px, not the 16px the ui.css
        // rule actually said — an accident, not a decision. Removed; .input
        // now reads var(--text-sm) directly, so 14px is what the rule
        // itself says, matching the reference control on purpose.
        "input file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:bg-input/50 dark:bg-input/30 dark:disabled:bg-input/80 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
