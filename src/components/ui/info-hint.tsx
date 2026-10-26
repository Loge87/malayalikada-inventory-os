"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * A small "i" icon that reveals helper text: on hover with a mouse, on tap
 * on touch devices (and on keyboard focus + Enter/Space). Sits next to a
 * field's label in place of always-visible helper text.
 */
export function InfoHint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        openOnHover
        delay={80}
        closeDelay={120}
        aria-label={label}
        className="relative inline-flex size-5 shrink-0 after:absolute after:-inset-2 after:content-[''] cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      >
        <Info className="size-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-64 text-xs leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}
