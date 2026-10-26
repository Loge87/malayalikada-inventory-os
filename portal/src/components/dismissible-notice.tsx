"use client";

import { useEffect, useState } from "react";

/** A slim notice bar the visitor can close. The choice is remembered in this
 *  browser, so it stops reappearing on every page. */
export function DismissibleNotice({ id, children }: { id: string; children: React.ReactNode }) {
  const key = `portal-notice-${id}`;
  const [hidden, setHidden] = useState(true); // hidden until we've checked storage

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);

  if (hidden) return null;
  return (
    <div className="relative bg-accent/15 px-10 py-2 text-center text-sm">
      {children}
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-black/5 hover:text-ink"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(key, "1");
          } catch {}
        }}
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
