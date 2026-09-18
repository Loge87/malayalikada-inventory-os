"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  inviteMember,
  removeMember,
  updateMemberRole,
} from "@/app/(app)/settings/team/actions";
import { formatDate } from "@/lib/format";
import type { Role } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
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
};

const ROLE_ITEMS: Record<Role, string> = {
  staff: "Staff",
  admin: "Admin",
  owner: "Owner",
};

function InviteMemberForm() {
  const [state, formAction, pending] = useActionState(inviteMember, undefined);
  const router = useRouter();

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
                <Select name="role" defaultValue="staff" items={ROLE_ITEMS}>
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
  isSelf,
  isSoleOwner,
}: {
  member: Member;
  isSelf: boolean;
  isSoleOwner: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState(
    updateMemberRole,
    undefined
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeMember,
    undefined
  );
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const router = useRouter();

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
          {/* Not a <form>+requestSubmit() — Base UI's Select calls
             onValueChange *before* it updates its own internal value/hidden
             field (see SelectRoot's setValue()), so requestSubmit() would
             submit the previous role, not the one just picked. Building the
             FormData from the callback's own `value` argument and calling
             the action directly sidesteps that race entirely. */}
          <Select
            items={ROLE_ITEMS}
            defaultValue={member.role}
            disabled={isSoleOwner || rolePending}
            onValueChange={(value) => {
              if (value == null) return;
              const formData = new FormData();
              formData.set("userId", member.userId);
              formData.set("role", value);
              roleAction(formData);
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

          {!confirmingRemove ? (
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
          )}
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
    </li>
  );
}

export function TeamManagement({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const ownerCount = members.filter((m) => m.role === "owner").length;

  return (
    <div className="flex flex-col gap-6">
      <InviteMemberForm />

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
                isSelf={member.userId === currentUserId}
                isSoleOwner={member.role === "owner" && ownerCount <= 1}
              />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
