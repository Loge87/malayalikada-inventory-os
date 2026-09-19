"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createLocation } from "@/app/(app)/locations/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastManager } from "@/components/ui/toast";

const TYPE_ITEMS: Record<string, string> = {
  warehouse: "Warehouse",
  store: "Store",
};

/**
 * The create-location form's fields — used inside AddLocationDialog's popup
 * (not inline on the page anymore, see /locations). `onCreated` closes that
 * dialog once the create actually succeeds.
 */
export function LocationForm({ onCreated }: { onCreated?: () => void }) {
  const [state, formAction, pending] = useActionState(createLocation, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
      router.refresh();
      toastManager.add({ title: "Location added", type: "success" });
      onCreated?.();
    }
  }, [state, router, onCreated]);

  return (
    <form ref={formRef} action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            placeholder="Main Warehouse"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="type">Type</FieldLabel>
          <Select name="type" defaultValue="warehouse" items={TYPE_ITEMS}>
            <SelectTrigger id="type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="warehouse">Warehouse</SelectItem>
              <SelectItem value="store">Store</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {state && "error" in state ? (
          <FieldError>{state.error}</FieldError>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Adding…" : "Add location"}
        </Button>
      </FieldGroup>
    </form>
  );
}
