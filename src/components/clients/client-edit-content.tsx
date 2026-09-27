"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { updateClient } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import type { EditableClient } from "@/components/clients/clients-list";

/**
 * The actual editable content for a client — name, contact person, phone,
 * email, address, and active status. Shared, unchanged, between the desktop
 * persistent side panel (ClientEditPanel) and the mobile full-page edit
 * route (ClientEditPageContent), same split as LocationEditContent.
 *
 * No delete here — delete is a row action on the list itself (see
 * ClientsList), same as locations.
 */
export function ClientEditContent({ client }: { client: EditableClient }) {
  const [state, formAction, pending] = useActionState(updateClient, undefined);
  const [isActive, setIsActive] = useState(client.isActive);
  const router = useRouter();
  const idPrefix = `edit-client-${client.id}`;

  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      toastManager.add({ title: "Client saved", type: "success" });
    }
  }, [state, router]);

  return (
    <div className="flex flex-col gap-4">
      {!client.isActive ? (
        <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          This client is inactive — it had stock-out history, so it was
          deactivated rather than deleted. Check &ldquo;Active&rdquo; below
          to reactivate it.
        </p>
      ) : null}

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="clientId" value={client.id} />
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
            <Input id={`${idPrefix}-name`} name="name" defaultValue={client.name} required />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-contactPerson`}>Contact person</FieldLabel>
            <Input
              id={`${idPrefix}-contactPerson`}
              name="contactPerson"
              defaultValue={client.contactPerson ?? ""}
              placeholder="Optional"
            />
          </Field>
          <Field orientation="responsive">
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-phone`}>Phone</FieldLabel>
              <Input id={`${idPrefix}-phone`} name="phone" defaultValue={client.phone} required />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-email`}>Email</FieldLabel>
              <Input
                id={`${idPrefix}-email`}
                name="email"
                type="email"
                defaultValue={client.email ?? ""}
                placeholder="Optional"
              />
            </Field>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-address`}>Address</FieldLabel>
            <Input
              id={`${idPrefix}-address`}
              name="address"
              defaultValue={client.address}
              required
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            Active
          </label>
          {/* A real, always-submitted checkbox input — see
              price-settings-form.tsx's wholesaleUsesSameAsRetail for the
              same pattern and its rationale. */}
          <input
            type="checkbox"
            name="isActive"
            checked={isActive}
            onChange={() => {}}
            className="hidden"
            aria-hidden
          />

          {state && "error" in state ? <FieldError>{state.error}</FieldError> : null}

          <Button type="submit" size="sm" disabled={pending} className="w-fit">
            {pending ? "Saving…" : "Save client"}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
