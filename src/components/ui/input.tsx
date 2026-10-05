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
        "input file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:bg-input/50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
