"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { CheckCircle2, AlertCircle, Info, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * One shared manager instance, module-scoped — any "use client" component
 * can `import { toastManager } from "@/components/ui/toast"` and call
 * `toastManager.add({...})` directly after a server action succeeds,
 * without needing to be inside a hook or pass a callback down. Same
 * primitive family (@base-ui/react) as every other component in ui/ —
 * this project's shadcn setup is the Base UI style, not Radix, so this
 * stays consistent with Dialog/Select/Menu rather than pulling in a
 * separate toast library (e.g. sonner) for just this one piece.
 */
export const toastManager = ToastPrimitive.createToastManager()

const TYPE_ICON: Record<string, React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const TYPE_ICON_CLASS: Record<string, string> = {
  success: "text-status-success",
  error: "text-destructive",
  info: "text-primary",
}

/** Mount once, near the root — renders nothing visible until a toast is
 *  added via `toastManager.add(...)`. */
export function Toaster() {
  return (
    <ToastPrimitive.Provider toastManager={toastManager}>
      <ToastViewport />
    </ToastPrimitive.Provider>
  )
}

function ToastViewport() {
  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport className="fixed inset-x-4 bottom-4 z-100 mx-auto flex w-full max-w-sm flex-col-reverse gap-2 outline-none sm:right-6 sm:bottom-6 sm:left-auto">
        <ToastList />
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  )
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()

  return toasts.map((toast) => {
    const Icon = TYPE_ICON[toast.type ?? ""] ?? null

    return (
      <ToastPrimitive.Root
        key={toast.id}
        toast={toast}
        swipeDirection={["down", "right"]}
        className={cn(
          "relative flex w-full items-start gap-3 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-elevated ring-1 ring-foreground/10 transition-all select-none",
          "data-starting-style:translate-y-2 data-starting-style:opacity-0",
          "data-ending-style:opacity-0",
          "data-[swipe-direction=right]:translate-x-(--toast-swipe-movement-x) data-[swipe-direction=down]:translate-y-(--toast-swipe-movement-y)"
        )}
      >
        {Icon ? (
          <Icon
            className={cn(
              "mt-0.5 size-4 shrink-0",
              TYPE_ICON_CLASS[toast.type ?? ""]
            )}
          />
        ) : null}
        <ToastPrimitive.Content className="flex flex-1 flex-col gap-0.5 pr-4">
          {toast.title ? (
            <ToastPrimitive.Title className="font-medium" />
          ) : null}
          {toast.description ? (
            <ToastPrimitive.Description className="text-muted-foreground" />
          ) : null}
        </ToastPrimitive.Content>
        <ToastPrimitive.Close
          aria-label="Dismiss"
          className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/80"
        >
          <XIcon className="size-3.5" />
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>
    )
  })
}
