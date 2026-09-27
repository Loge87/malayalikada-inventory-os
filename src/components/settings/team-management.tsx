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
import type { Role } from "@/lib/permissions";
import type { LocationOption } from "@/components/products/variant-extra-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toastManager } from "@/components/ui/toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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

/** A plain checkbox list, not a searchable combobox — an organisation's
 *  location count is small (a handful of stores), so search would be
 *  overhead without benefit. Fully controlled (checked/onCheckedChange),
 *  same convention as price-settings-form's "use same as retail" checkbox. */
function LocationCheckboxes({
  idPrefix,
  locations,
  selectedIds,
  onToggle,
  disabled,
}: {
  idPrefix: string;
  locations: LocationOption[];
  selectedIds: string[];
  onToggle: (locationId: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {locations.map((location) => (
        <label
          key={location.id}
          htmlFor={`${idPrefix}-${location.id}`}
          className="flex items-center gap-2 text-sm"
        >
          <Checkbox
            id={`${idPrefix}-${location.id}`}
            checked={selectedIds.includes(location.id)}
            disabled={disabled}
            onCheckedChange={(checked) => onToggle(location.id, checked === true)}
          />
          {location.name}
        </label>
      ))}
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
    <Card>
      <CardHeader>
        <CardTitle>Invite member</CardTitle>
        <CardDescription>
          Only works if the person already has an account — there&apos;s no
          email-invite system yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="locationIds" value={JSON.stringify(locationIds)} />
          <FieldGroup>
            <Field orientation="responsive">
              <Field>
                <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  placeholder="colleague@example.com"
                  required
                />
              </Field>
              <Field>
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
            </Field>

            {locations.length > 0 ? (
              <Field>
                <FieldLabel>
                  Locations{role === "staff" ? " (required for staff)" : " (optional)"}
                </FieldLabel>
                <LocationCheckboxes
                  idPrefix="invite-location"
                  locations={locations}
                  selectedIds={locationIds}
                  onToggle={(locationId, checked) =>
                    setLocationIds((current) =>
                      checked
                        ? [...current, locationId]
                        : current.filter((id) => id !== locationId)
                    )
                  }
                />
              </Field>
            ) : null}

            {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}
            {state && "needsSignup" in state ? (
              <p className="rounded-md bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
                This person needs to sign up first at{" "}
                <span className="font-medium break-all">{state.signupUrl}</span>
                , then you can add them here.
              </p>
            ) : null}
            {state && "ok" in state ? (
              <p className="rounded-md bg-status-success/10 px-3 py-2 text-sm text-status-success">
                Member added.
              </p>
            ) : null}

            <Button type="submit" disabled={pending} className="w-fit">
              {pending ? "Checking…" : "Invite"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
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
    if (roleState && "ok" in roleState) {
      router.refresh();
      toastManager.add({ title: `Role updated for ${member.email}`, type: "success" });
    }
  }, [roleState, member.email, router]);

  useEffect(() => {
    if (removeState && "ok" in removeState) {
      router.refresh();
      toastManager.add({ title: `${member.email} removed`, type: "success" });
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

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate font-medium">
            {member.email}
            {isSelf ? (
              <span className="ml-1 text-xs text-muted-foreground">(you)</span>
            ) : null}
          </span>
          <span className="text-caption">
            Added {formatDate(member.createdAt)}
          </span>
        </div>

        <div className="flex items-center gap-2">
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
              <SelectTrigger className="w-32">
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

          {canManageRoles ? (
            !confirmingRemove ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSoleOwner}
                onClick={() => setConfirmingRemove(true)}
              >
                Remove
              </Button>
            ) : (
              <form action={removeAction} className="flex items-center gap-2">
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
        </div>
      </div>

      {isSoleOwner ? (
        <p className="text-caption">
          The only owner — add another owner before changing or removing this
          one.
        </p>
      ) : null}
      {roleState && "error" in roleState ? (
        <FieldError>{roleState.error}</FieldError>
      ) : null}
      {removeState && "error" in removeState ? (
        <FieldError>{removeState.error}</FieldError>
      ) : null}

      {canManageLocations && locations.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-caption">
            Locations
            {/* Purely informational — never disables the checkboxes below,
                which stay clickable the whole time the save is in flight. */}
            {locationsPending ? (
              <span className="ml-1 text-muted-foreground">Saving…</span>
            ) : null}
          </span>
          <LocationCheckboxes
            idPrefix={`member-${member.userId}-location`}
            locations={locations}
            selectedIds={checkedLocationIds}
            onToggle={toggleLocation}
          />
          {member.role === "staff" && checkedLocationIds.length === 0 ? (
            <p className="text-xs text-status-warning">
              No location assigned — this member can&apos;t use Stock Out yet.
            </p>
          ) : null}
          {locationsState && "error" in locationsState ? (
            <FieldError>{locationsState.error}</FieldError>
          ) : null}
        </div>
      ) : null}
    </li>
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

  return (
    <div className="flex flex-col gap-6">
      {canManageRoles ? <InviteMemberForm locations={locations} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {members.length} member{members.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {members.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                locations={locations}
                isSelf={member.userId === currentUserId}
                isSoleOwner={member.role === "owner" && ownerCount <= 1}
                canManageRoles={canManageRoles}
                canManageLocations={canManageLocations}
              />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
