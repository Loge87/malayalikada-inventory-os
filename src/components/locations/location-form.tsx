"use client";

import { useActionState, useEffect, useRef } from "react";

import { createLocation } from "@/app/(app)/locations/actions";
import { Button } from "@/components/ui/button";
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

const TYPE_ITEMS: Record<string, string> = {
  warehouse: "Warehouse",
  store: "Store",
};

export function LocationForm() {
  const [state, formAction, pending] = useActionState(createLocation, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New location</CardTitle>
        <CardDescription>
          Add a warehouse or store to your organisation.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
