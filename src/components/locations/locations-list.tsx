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
    if (!state) return;
    if ("ok" in state) {
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
    } else {
      // CORRECTED this pass — this table is now table-layout: fixed with a
      // fixed Actions column width (matching Clients — see this file's own
      // note on the shared pattern), so an inline error paragraph here
      // would either overflow or wrap and grow the row past its fixed
      // height; a toast carries it instead, same as Clients/Team.
      toastManager.add({ title: state.error, type: "error" });
    }
  }, [state, router, location.name]);

  return (
    <tr
      onClick={() => onEdit(location.id)}
      aria-selected={isSelected}
      className="table-row cursor-pointer"
      // A fixed row height, same token/value Clients and Team now read —
      // see this file's own note on the shared fixed-column pattern.
      style={{ height: "var(--space-table-row-height)" }}
    >
      <td className="py-3 pr-2 font-medium">
        <span className="block truncate" title={location.name}>
          {location.name}
        </span>
      </td>
      <td className="py-3 pr-2 text-muted-foreground capitalize">
        {location.type}
      </td>
      <td className="py-3 pr-2">
        <ActiveStatusPill isActive={location.isActive} />
      </td>
      <td
        className="cell-number py-3"
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
          // CORRECTED this pass — the "Delete X?" text used to sit inline
          // here; now a title attribute instead, same fix Clients already
          // has (a fixed, narrow Actions column can't let this wrap
          // without growing the row past its fixed height).
          <form
            action={formAction}
            className="flex items-center justify-end gap-2"
            title={`Delete "${location.name}"?`}
          >
            <input type="hidden" name="locationId" value={location.id} />
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
      {/* .table/.table-head — not raw markup — see
          expiring-soon-table.tsx's own note for why. table-layout: fixed +
          a <colgroup> — this table now matches Clients/Team's shared
          fixed-column pattern (see theme.css's --location-col-* tokens). */}
      <table className="table table-fixed">
        <colgroup>
          <col style={{ width: "var(--location-col-name)" }} />
          <col style={{ width: "var(--location-col-type)" }} />
          <col style={{ width: "var(--location-col-status)" }} />
          <col style={{ width: "var(--location-col-actions)" }} />
        </colgroup>
        <thead>
          <tr className="table-head">
            <th className="pr-2 font-medium text-muted-foreground">Name</th>
            <th className="pr-2 font-medium text-muted-foreground">Type</th>
            <th className="pr-2 font-medium text-muted-foreground">Status</th>
            <th className="font-medium" aria-hidden />
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
