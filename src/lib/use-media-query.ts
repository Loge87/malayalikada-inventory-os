"use client";

import { useSyncExternalStore } from "react";

/**
 * Tracks a media query in JS, for the rare case a component needs to *decide*
 * something at click-time rather than just show/hide two variants with CSS.
 * Server/first-client snapshot is always `false` — that's never a hydration
 * mismatch here, since it only ever drives event-handler logic, not the
 * initial markup.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Same breakpoint the nav uses (Tailwind's `md`) to switch between the
 *  desktop sidebar and the mobile bottom bar / menu. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
