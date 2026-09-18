"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { toastManager } from "@/components/ui/toast";

/**
 * Fires the "[Product name] added" toast after createProductWithVariant's
 * redirect() lands here (on /products or /scan). A Server Action's
 * redirect() throws before useActionState ever sees the success result, so
 * there's no client state to react to the normal way — the action encodes
 * the created product's name in a `created` query param on the redirect
 * target instead. This reads it once on mount, then strips it from the URL
 * so a refresh (or sharing the link) doesn't re-fire the toast.
 */
export function ProductCreatedToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const created = searchParams.get("created");

  useEffect(() => {
    if (!created) return;

    toastManager.add({ title: `${created} added`, type: "success" });

    const next = new URLSearchParams(searchParams);
    next.delete("created");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created]);

  return null;
}
