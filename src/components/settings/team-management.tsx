"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  assignMemberLocations,
  inviteMember,
  removeMember,
  updateMemberRole,
} from "@/app/(app)/settings/team/actions";
import { formatDate } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import type { Role } from "@/lib/permissions";
import type { LocationOption } from "@/components/products/variant-extra-fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toastManager } from "@/components/ui/toast";
import { MultiSelect } from "@/components/ui/multi-select";
import { TablePagination } from "@/components/dashboard/table-pagination";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Member = {
  userId: string;
  email: string;
  role: string;
  createdAt: string;
  /** Location ids assigned via user_locations (Stock Out feature). */
  locationIds: string[];
};

const ROLE_ITEMS: Record<Role, string> = {
  staff: "Staff",
  admin: "Admin",
  owner: "Owner",
};

const MEMBERS_PAGE_SIZE = 25;

/**
 * The Locations control for one member table row — a MultiSelect (see
 * ui/multi-select.tsx), the exact same component/trigger shape the
 * invite row's own Locations field uses. A fixed-width wrapper plus a
 * reserved slot for "Saving…"/the warning/the error keeps the column's
 * own rendered width unaffected by any of those transient states.
 */
function LocationsCell({
  idPrefix,
  locations,
  selectedIds,
  onToggle,
  pending,
  warning,
  error,
  disabled,
}: {
  idPrefix: string;
  locations: LocationOption[];
  selectedIds: string[];
  onToggle: (locationId: string, checked: boolean) => void;
  pending?: boolean;
  warning?: string;
  error?: string;
  disabled?: boolean;
}) {
  if (locations.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="relative">
      <MultiSelect
        idPrefix={idPrefix}
        options={locations.map((l) => ({ id: l.id, label: l.name }))}
        selectedIds={selectedIds}
        onToggle={onToggle}
        disabled={disabled}
        placeholder="None"
        triggerClassName="h-8 w-full px-2 text-xs"
      />
      {/* CORRECTED this pass — used to be a sibling line below the trigger,
          which added its own height to this cell's natural content height
          and was the single biggest reason Team's row measured taller than
          Clients'/Locations' (this session's "make the tables match"
          request). absolute + top-full takes it OUT of layout entirely —
          it still never reflows the column's WIDTH (the original item 8
          concern, still true), and now never grows the row's HEIGHT either.
          It floats just under the trigger when something's actually
          showing, same as a validation hint under a field elsewhere in
          the app. */}
      <span className="absolute top-full left-0 block text-[11px] leading-[14px] whitespace-nowrap">
        {pending ? (
          <span className="text-muted-foreground">Saving…</span>
        ) : error ? (
          <span className="text-destructive">{error}</span>
        ) : warning ? (
          <span className="text-status-warning">{warning}</span>
        ) : null}
      </span>
    </div>
  );
}

function InviteMemberForm({ locations }: { locations: LocationOption[] }) {
  const [state, formAction, pending] = useActionState(inviteMember, undefined);
  const [role, setRole] = useState<Role>("staff");
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const router = useRouter();

  // Render-phase "adjust state when something changes" (not an effect) —
  // resets the form's own fields once a create actually completes. Same
  // pattern as ProductsTable's bulk-delete handling.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state && "ok" in state) {
      setRole("staff");
      setLocationIds([]);
    }
  }

  // Same latent bug as the products list: revalidatePath() in the server
  // action doesn't update this already-mounted member list — router.refresh()
  // does.
  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      toastManager.add({ title: "Member added", type: "success" });
    }
  }, [state, router]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg bg-muted/30 p-3"
    >
      <input type="hidden" name="locationIds" value={JSON.stringify(locationIds)} />
      <div className="flex flex-wrap items-end gap-3">
        {/* min-w-(--invite-email-width): a fixed, ~17%-narrower floor than
            the previous min-w-48 (12rem -> 10rem) — see theme.css's own
            comment on --invite-email-width for the exact math. Still
            flex-1, so it grows to fill the row same as before; this only
            lowers how small it's allowed to get before the role/locations
            controls beside it start losing space. */}
        <Field className="min-w-(--invite-email-width) flex-1">
          <FieldLabel htmlFor="invite-email">Email</FieldLabel>
          <Input
            id="invite-email"
            name="email"
            type="email"
            placeholder="colleague@example.com"
            required
          />
        </Field>
        <Field className="w-32">
          <FieldLabel htmlFor="invite-role">Role</FieldLabel>
          <Select
            name="role"
            value={role}
            items={ROLE_ITEMS}
            onValueChange={(value) => {
              if (value == null) return;
              setRole(value as Role);
            }}
          >
            <SelectTrigger id="invite-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROLE_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {locations.length > 0 ? (
          <Field className="w-56">
            <FieldLabel>
              Locations{role === "staff" ? " (required)" : " (optional)"}
            </FieldLabel>
            <MultiSelect
              idPrefix="invite-location"
              options={locations.map((l) => ({ id: l.id, label: l.name }))}
              selectedIds={locationIds}
              onToggle={(locationId, checked) =>
                setLocationIds((current) =>
                  checked
                    ? [...current, locationId]
                    : current.filter((id) => id !== locationId)
                )
              }
              triggerClassName="w-full"
            />
          </Field>
        ) : null}

        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Checking…" : "Invite"}
        </Button>
      </div>

      {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}
      {state && "needsSignup" in state ? (
        <p className="rounded-md bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
          This person needs to sign up first at{" "}
          <span className="font-medium break-all">{state.signupUrl}</span>, then
          you can add them here.
        </p>
      ) : null}
      {state && "ok" in state ? (
        <p className="rounded-md bg-status-success/10 px-3 py-2 text-sm text-status-success">
          Member added.
        </p>
      ) : null}
    </form>
  );
}

function MemberRow({
  member,
  locations,
  isSelf,
  isSoleOwner,
  canManageRoles,
  canManageLocations,
}: {
  member: Member;
  locations: LocationOption[];
  isSelf: boolean;
  isSoleOwner: boolean;
  canManageRoles: boolean;
  canManageLocations: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState(
    updateMemberRole,
    undefined
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeMember,
    undefined
  );
  const [locationsState, locationsAction, locationsPending] = useActionState(
    assignMemberLocations,
    undefined
  );
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const router = useRouter();

  // Optimistic location assignment — the actual bug fix. Checkbox `checked`
  // used to be bound directly to member.locationIds (a server-rendered
  // prop), so it could only change after the server action's full round
  // trip AND a router.refresh() re-ran the whole page's Server Components —
  // a checkbox click waited on a network request just to look checked.
  // This local state is the new source of truth for what's checked: a
  // toggle updates it immediately, then saves in the background.
  // confirmedLocationIds is the last known GOOD (server-confirmed) set, so
  // a failed save can revert to it rather than leaving the UI showing a
  // change that didn't actually persist.
  const [checkedLocationIds, setCheckedLocationIds] = useState(member.locationIds);
  const confirmedLocationIds = useRef(member.locationIds);
  const pendingLocationIds = useRef(member.locationIds);

  useEffect(() => {
    if (!roleState) return;
    if ("ok" in roleState) {
      router.refresh();
      toastManager.add({ title: `Role updated for ${member.email}`, type: "success" });
    } else {
      // CORRECTED this pass — item 8: a fixed-column table can't let an
      // error message grow a cell, so this goes to a toast instead of the
      // inline FieldError this used to render in the Role column.
      toastManager.add({ title: roleState.error, type: "error" });
    }
  }, [roleState, member.email, router]);

  useEffect(() => {
    if (!removeState) return;
    if ("ok" in removeState) {
      router.refresh();
      toastManager.add({ title: `${member.email} removed`, type: "success" });
    } else {
      // CORRECTED this pass — same reasoning as roleState's error above.
      toastManager.add({ title: removeState.error, type: "error" });
    }
  }, [removeState, member.email, router]);

  useEffect(() => {
    if (!locationsState) return;
    if ("ok" in locationsState) {
      // The save that just resolved is whatever was pending at the time —
      // that's now the confirmed baseline. checkedLocationIds already shows
      // this (it was set optimistically before the save started), so no
      // visual change here; router.refresh() just resyncs the underlying
      // server-rendered prop in the background, not something the UI is
      // waiting on.
      confirmedLocationIds.current = pendingLocationIds.current;
      router.refresh();
      toastManager.add({ title: `Locations updated for ${member.email}`, type: "success" });
    } else {
      // Revert the optimistic change — it didn't actually persist.
      setCheckedLocationIds(confirmedLocationIds.current);
    }
  }, [locationsState, member.email, router]);

  // The actual fix: checkedLocationIds is local state, updated the instant a
  // checkbox is clicked — no waiting on the server action or a
  // router.refresh() to see it. That update stays a plain synchronous
  // setState call, outside the transition below, so it's never deferred.
  //
  // locationsAction is an action returned by useActionState — calling it
  // directly (not via a <form action=...>/formAction prop) is only valid
  // inside startTransition; React throws "called outside of a transition"
  // otherwise. Wrapping just this call (not the setCheckedLocationIds above)
  // means the save is what's tracked as pending, while the checkbox flip
  // itself stays untouched by that scheduling.
  function toggleLocation(locationId: string, checked: boolean) {
    const next = checked
      ? [...checkedLocationIds, locationId]
      : checkedLocationIds.filter((id) => id !== locationId);
    setCheckedLocationIds(next);
    pendingLocationIds.current = next;
    const formData = new FormData();
    formData.set("userId", member.userId);
    formData.set("locationIds", JSON.stringify(next));
    startTransition(() => {
      locationsAction(formData);
    });
  }

  const locationsWarning =
    member.role === "staff" && checkedLocationIds.length === 0
      ? "No location assigned — this member can't use Stock Out yet."
      : undefined;
  const locationsError =
    locationsState && "error" in locationsState ? locationsState.error : undefined;

  return (
    <tr className="table-row" style={{ height: "var(--space-table-row-height)" }}>
      <td className="py-3 pr-2">
        <span className="block truncate font-medium" title={member.email}>
          {member.email}
          {isSelf ? (
            <span className="ml-1 text-xs text-muted-foreground">(you)</span>
          ) : null}
        </span>
      </td>
      <td className="py-3 pr-2">
        {canManageRoles ? (
          // Not a <form>+requestSubmit() — Base UI's Select calls
          // onValueChange *before* it updates its own internal value/hidden
          // field (see SelectRoot's setValue()), so requestSubmit() would
          // submit the previous role, not the one just picked. Building the
          // FormData from the callback's own `value` argument and calling
          // the action directly sidesteps that race entirely.
          <Select
            items={ROLE_ITEMS}
            defaultValue={member.role}
            disabled={isSoleOwner || rolePending}
            onValueChange={(value) => {
              if (value == null) return;
              const formData = new FormData();
              formData.set("userId", member.userId);
              formData.set("role", value);
              // roleAction is a useActionState action — calling it
              // directly (not via a <form action=.../formAction prop)
              // requires startTransition, same as locationsAction above.
              startTransition(() => {
                roleAction(formData);
              });
            }}
          >
            <SelectTrigger className="h-8 w-28 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROLE_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground">
            {ROLE_ITEMS[member.role as Role] ?? member.role}
          </span>
        )}
      </td>
      <td className="py-3 pr-2">
        {canManageLocations ? (
          <LocationsCell
            idPrefix={`member-${member.userId}-location`}
            locations={locations}
            selectedIds={checkedLocationIds}
            onToggle={toggleLocation}
            pending={locationsPending}
            warning={locationsWarning}
            error={locationsError}
          />
        ) : (
          <LocationsCell
            idPrefix={`member-${member.userId}-location`}
            locations={locations}
            selectedIds={member.locationIds}
            onToggle={() => {}}
            disabled
          />
        )}
      </td>
      <td className="py-3 pr-2 text-xs text-muted-foreground">
        {formatDate(member.createdAt)}
      </td>
      <td className="cell-number py-3">
        {canManageRoles ? (
          isSoleOwner ? (
            <span className="text-caption">Sole owner</span>
          ) : !confirmingRemove ? (
            // Plain <button>, not the shared Button component — matches
            // Clients'/Locations' "Delete" button exactly (same classes,
            // same destructive-red styling), not Team's own old pill-
            // shaped <Button variant="outline">. Remove is this row's
            // equivalent of "Delete" (a destructive, confirm-gated
            // action), so it reads from the same style, not Edit's
            // neutral one.
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              className="rounded-md px-2 py-1 text-xs font-medium text-destructive ring-1 ring-destructive/30 hover:bg-destructive/10"
            >
              Remove
            </button>
          ) : (
            <form action={removeAction} className="flex items-center justify-end gap-2">
              <input type="hidden" name="userId" value={member.userId} />
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={removePending}
              >
                {removePending ? "Removing…" : "Confirm"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={removePending}
                onClick={() => setConfirmingRemove(false)}
              >
                Cancel
              </Button>
            </form>
          )
        ) : null}
      </td>
    </tr>
  );
}

export function TeamManagement({
  members,
  locations,
  currentUserId,
  canManageRoles,
  canManageLocations,
}: {
  members: Member[];
  locations: LocationOption[];
  currentUserId: string;
  canManageRoles: boolean;
  canManageLocations: boolean;
}) {
  const ownerCount = members.filter((m) => m.role === "owner").length;
  const { pageItems, page, totalPages, setPage } = usePagination(
    members,
    MEMBERS_PAGE_SIZE
  );

  function rowProps(member: Member) {
    return {
      member,
      locations,
      isSelf: member.userId === currentUserId,
      isSoleOwner: member.role === "owner" && ownerCount <= 1,
      canManageRoles,
      canManageLocations,
    };
  }

  return (
    <div className="flex flex-col gap-5">
      {canManageRoles ? <InviteMemberForm locations={locations} /> : null}

      {/* Card/CardHeader/CardTitle/CardContent — the exact same wrapper
          ClientsPageContent/LocationsPageContent use around their own
          lists (elevated, "All X" title, a CardDescription, an empty-
          state <p> fallback). This table used to be a bare <div>, the
          single biggest reason it read as a different surface from
          Clients/Locations rather than another table in the same family. */}
      <Card elevated>
        <CardHeader>
          <CardTitle>All members</CardTitle>
          <CardDescription>
            {members.length} member{members.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground">No members yet</p>
          ) : (
            <>
              {/* table/table-head/table-row — the same shared classes
                  Clients/Locations read, table-layout: fixed plus a
                  colgroup (also now shared by all three — see theme.css's
                  team-col, client-col and location-col token groups, and
                  this pass's own VERIFY section for the measured zero-
                  delta column-width proof). No sticky header — Clients and
                  Locations don't scroll internally (the whole PAGE
                  scrolls), so a sticky header here had no real scroll
                  container to stick within anyway. */}
              <div className="overflow-x-auto">
                <table className="table table-fixed">
                  <colgroup>
                    <col style={{ width: "var(--team-col-member)" }} />
                    <col style={{ width: "var(--team-col-role)" }} />
                    <col style={{ width: "var(--team-col-locations)" }} />
                    <col style={{ width: "var(--team-col-added)" }} />
                    <col style={{ width: "var(--team-col-actions)" }} />
                  </colgroup>
                  <thead>
                    <tr className="table-head">
                      <th className="pr-2 font-medium text-muted-foreground">
                        Member
                      </th>
                      <th className="pr-2 font-medium text-muted-foreground">
                        Role
                      </th>
                      <th className="pr-2 font-medium text-muted-foreground">
                        Locations
                      </th>
                      <th className="pr-2 font-medium text-muted-foreground">
                        Added
                      </th>
                      <th className="font-medium" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((member) => (
                      <MemberRow key={member.userId} {...rowProps(member)} />
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination page={page} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
