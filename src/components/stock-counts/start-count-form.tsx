"use client";

import { useActionState, useEffect, useRef } from "react";

import { startStockCount } from "@/app/stock-counts/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type LocationOption = { id: string; name: string };

export function StartCountForm({
  locations,
}: {
  locations: LocationOption[];
}) {
  const [state, formAction, pending] = useActionState(
    startStockCount,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
    }
  }, [state]);

  const items: Record<string, string> = Object.fromEntries(
    locations.map((l) => [l.id, l.name])
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a count</CardTitle>
        <CardDescription>
          Snapshots the current on-hand quantity for every variant held at the
          location, then you enter what&apos;s physically there.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {locations.length > 0 ? (
          <form ref={formRef} action={formAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="locationId">Location</FieldLabel>
                <Select name="locationId" items={items}>
                  <SelectTrigger id="locationId" className="w-full">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {state && "error" in state ? (
                <FieldError>{state.error}</FieldError>
              ) : null}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Starting…" : "Start count"}
              </Button>
            </FieldGroup>
          </form>
        ) : (
          <p className="text-muted-foreground text-sm">
            Every location already has a count in progress.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
