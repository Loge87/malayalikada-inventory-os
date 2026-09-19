"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { deleteLocation } from "@/app/(app)/locations/actions";
import type { LocationType } from "@/app/(app)/locations/constants";
import { useIsWideDesktop } from "@/lib/use-media-query";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import { usePermissions } from "@/components/providers/role-provider";
import { cn } from "@/lib/utils";

export type EditableLocation = {
  id: string;
  name: string;
  type: LocationType;
  isActive: boolean;
};

function ActiveStatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        isActive
          ? "bg-status-success/10 text-status-success"
          : "bg-muted text-muted-foreground"
      )}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function LocationRow({
  location,
  isSelected,
  canManage,
  onEdit,
}: {
  location: EditableLocation;
  isSelected: boolean;
  canManage: boolean;
  onEdit: (locationId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deleteLocation, undefined);
  const router = useRouter();

  // Render-phase "adjust state when something changes" (not an effect) —
  // collapses the confirm/cancel form back once a delete actually
  // completes. Same pattern as ProductsTable's bulk-delete handling.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state && "ok" in state) {
      setConfirming(false);
    }
  }

  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      // state.result is "deactivated" when the location had inventory or
      // purchase-order history — say so rather than claiming "deleted" for a
      // row that's actually still there. Same wording rule as deleteProduct.
      toastManager.add({
        title:
          state.result === "deactivated"
            ? `${location.name} deactivated`
            : `${location.name} deleted`,
        type: "success",
      });
    }
  }, [state, router, location.name]);

  return (
    <tr
      onClick={() => onEdit(location.id)}
      aria-selected={isSelected}
      className={cn(
        "cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/50",
        isSelected && "bg-primary/5 hover:bg-primary/10"
      )}
    >
      <td className="py-3 pr-2 font-medium">{location.name}</td>
      <td className="py-3 pr-2 text-muted-foreground capitalize">
        {location.type}
      </td>
      <td className="py-3 pr-2">
        <ActiveStatusPill isActive={location.isActive} />
      </td>
      <td
        className="py-3 pl-2 text-right"
        onClick={(event) => event.stopPropagation()}
      >
        {!canManage ? null : !confirming ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onEdit(location.id)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 hover:bg-muted hover:text-foreground"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-md px-2 py-1 text-xs font-medium text-destructive ring-1 ring-destructive/30 hover:bg-destructive/10"
            >
              Delete
            </button>
          </div>
        ) : (
          <form
            action={formAction}
            className="flex flex-wrap items-center justify-end gap-2"
          >
            <input type="hidden" name="locationId" value={location.id} />
            <span className="text-xs text-muted-foreground">
              Delete &ldquo;{location.name}&rdquo;?
            </span>
            <Button type="submit" variant="destructive" size="sm" disabled={pending}>
              {pending ? "Deleting…" : "Confirm"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </form>
        )}
        {state && "error" in state ? (
          <p className="mt-1 text-xs text-destructive">{state.error}</p>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * The locations list — mirrors ProductsTable's responsive edit pattern
 * (openEdit below) but stays simple: no search/sort/pagination, since an
 * organisation's location count is small. Delete lives directly on each row
 * (not inside the edit panel, unlike deleteProduct's "danger zone") — the
 * confirmation-step UI is the same two-step confirm/cancel shape either way.
 */
export function LocationsList({
  locations,
  selectedLocationId,
  onSelectLocation,
}: {
  locations: EditableLocation[];
  /** The location currently open in the desktop side panel (owned by the
   *  parent, LocationsPageContent) — only used to highlight its row. */
  selectedLocationId: string | null;
  /** Desktop: open/replace the side panel with this location. Mobile never
   *  calls this — openEdit() below routes to the full-page edit route
   *  instead. */
  onSelectLocation: (locationId: string) => void;
}) {
  const router = useRouter();
  const { can } = usePermissions();
  const isWideDesktop = useIsWideDesktop();

  function openEdit(locationId: string) {
    if (isWideDesktop) {
      onSelectLocation(locationId);
    } else {
      router.push(`/locations/${locationId}/edit`);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs">
            <th className="py-2 font-medium text-muted-foreground">Name</th>
            <th className="py-2 font-medium text-muted-foreground">Type</th>
            <th className="py-2 font-medium text-muted-foreground">Status</th>
            <th className="py-2 pl-2 font-medium" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {locations.map((location) => (
            <LocationRow
              key={location.id}
              location={location}
              isSelected={selectedLocationId === location.id}
              canManage={can("locations:manage")}
              onEdit={openEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
