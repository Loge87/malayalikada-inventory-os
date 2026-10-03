import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  size = "default",
  elevated = false,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  /** Opt-in stronger-presence surface — flat bg-card (no gradient, no
   *  backdrop-blur; both were tried in earlier passes and explicitly
   *  reversed) plus a light, barely-there shadow (--shadow-elevated,
   *  closer in weight to shadow-sm than shadow-md) instead of the ring the
   *  default card uses — shadow alone does the separation work here.
   *  Deliberately a prop, not the new default, so this stays scoped to the
   *  pages that have adopted it. Was named `glossy` when it did carry a
   *  gradient; renamed once that was removed so the prop still describes
   *  what it actually does. */
  elevated?: boolean
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        // .card (ui.css) supplies the surface color and radius; the
        // shadow is the one thing that still varies by the `elevated`
        // prop, so it stays a call-site override reading the same two
        // theme.css tokens .card itself is built from.
        "card group/card flex flex-col gap-(--card-spacing) overflow-hidden py-(--card-spacing) text-sm transition-shadow duration-300 ease-out [--card-spacing:var(--space-card-padding)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        elevated && "shadow-(--shadow-raised)",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "card-header group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
