import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // .btn (ui.css) carries the shared shape/spacing/interaction states —
  // radius, focus ring, active press, disabled fade — that used to be
  // spelled out here. Only the parts genuinely specific to this component
  // (icon sizing/pointer-events, the aria-invalid state) stay as Tailwind
  // utilities.
  "btn group/button select-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // .btn-primary (ui.css) carries the fill/text/shadow for all three
        // states (rest/hover/active) — see globals.css for the measured
        // contrast per state.
        default: "btn-primary",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "btn-secondary aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost: "btn-ghost aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive: "btn-danger",
        // Not currently used anywhere in the app. Plain --foreground with
        // an always-on underline, not text-brand-accent — the current
        // brand color is light/vivid enough that it reads at ~1.6:1 on a
        // white/light background (illegible as text), and there's no
        // single accent shade that's both legible and the same hue in
        // both themes without a dedicated "link" token this app doesn't
        // have yet. The underline carries "this is a link" instead of
        // relying on color.
        link: "text-foreground underline underline-offset-4",
      },
      // CORRECTED this pass: default/lg used to carry their own Tailwind
      // `h-10 ... sm:h-9` height utility — a utilities-layer class, which
      // (per this file's own opening cascade note) WINS over ui.css's
      // `.btn` height for the same longhand property, so at >=640px these
      // two sizes silently rendered 36px tall while .input/.select stayed
      // 40px (--control-height) — the exact cross-control height mismatch
      // this pass's item 2 asked to fix. Neither size sets its own height
      // or horizontal padding anymore; both now come from .btn's own
      // --control-height/--control-padding-x (theme.css), same as every
      // other control on a row with them. xs/sm/icon* stay their own
      // smaller literal values on purpose — see theme.css's --control-
      // height comment for the full exclusion list.
      size: {
        default:
          "gap-1.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-7 gap-1.5 px-3 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "btn-sm has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "gap-1.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        icon: "btn-icon",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "btn-icon",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
