"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

/** True only once the client has actually mounted — the standard
 *  React-idiomatic way to ask "did we hydrate yet" without a setState-in-
 *  effect (which the project's lint config forbids for exactly the
 *  cascading-render reason it warns about). */
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Sun/moon toggle — the standard convention, so it needs no label to be
 * understood at a glance. Lives in the nav (desktop sidebar + mobile menu,
 * both via ProfileSection) rather than a settings page, per the "not
 * buried" requirement.
 *
 * Both icons are always in the DOM, cross-fading with a rotate+scale swap
 * driven purely by CSS transitions — before mount neither is "on" (both
 * scaled to 0), giving the same blank hit area for one paint the previous
 * conditional-render version had, without a hydration mismatch (next-themes
 * can't know the stored preference during server render, since it lives in
 * localStorage).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground",
        className
      )}
    >
      <Sun
        aria-hidden
        className={cn(
          "absolute size-4 transition-all duration-300 ease-out",
          isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
        )}
      />
      <Moon
        aria-hidden
        className={cn(
          "absolute size-4 transition-all duration-300 ease-out",
          mounted && !isDark
            ? "rotate-0 scale-100 opacity-100"
            : "rotate-90 scale-0 opacity-0"
        )}
      />
    </button>
  );
}
