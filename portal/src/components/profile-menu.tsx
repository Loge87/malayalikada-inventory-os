"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function ProfileMenu({
  email,
  businessName,
  showOrders,
  logoutAction,
}: {
  email: string;
  businessName: string | null;
  showOrders: boolean;
  logoutAction: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-soft";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="grid size-10 place-items-center rounded-full border border-line bg-white text-ink transition-colors hover:border-brand hover:text-brand"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
        </svg>
      </button>
      {open ? (
        <div className="menu-pop absolute right-0 mt-3 w-64 rounded-2xl border border-line bg-white p-2 shadow-[var(--shadow-lg)]">
          <div className="border-b border-line px-3 pb-3 pt-2">
            {businessName ? <div className="truncate text-sm font-bold">{businessName}</div> : null}
            <div className="truncate text-sm text-muted">{email}</div>
          </div>
          <div className="pt-2">
            <Link href="/settings" className={item}>Settings</Link>
            {showOrders ? <Link href="/orders" className={item}>My orders</Link> : null}
            <form action={logoutAction}>
              <button type="submit" className={`${item} w-full text-left text-danger`}>Sign out</button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
