"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { addClient } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";

/**
 * The create-client form's fields — used inside AddClientDialog's popup,
 * same split as LocationForm/AddLocationDialog. `onCreated` closes that
 * dialog once the create actually succeeds.
 */
export function ClientForm({ onCreated }: { onCreated?: () => void }) {
  const [state, formAction, pending] = useActionState(addClient, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
      router.refresh();
      toastManager.add({ title: "Client added", type: "success" });
      onCreated?.();
    }
  }, [state, router, onCreated]);

  return (
    <form ref={formRef} action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="client-name">Name</FieldLabel>
          <Input id="client-name" name="name" placeholder="Green Grocer Ltd" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="client-contactPerson">Contact person</FieldLabel>
          <Input id="client-contactPerson" name="contactPerson" placeholder="Optional" />
        </Field>
        <Field orientation="responsive">
          <Field>
            <FieldLabel htmlFor="client-phone">Phone</FieldLabel>
            <Input id="client-phone" name="phone" placeholder="021 123 4567" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="client-email">Email</FieldLabel>
            <Input
              id="client-email"
              name="email"
              type="email"
              placeholder="Optional"
            />
          </Field>
        </Field>
        <Field>
          <FieldLabel htmlFor="client-address">Address</FieldLabel>
          <Input id="client-address" name="address" placeholder="1 Queen St, Auckland" required />
        </Field>

        {state && "error" in state ? (
          <FieldError>{state.error}</FieldError>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Adding…" : "Add client"}
        </Button>
      </FieldGroup>
    </form>
  );
}
