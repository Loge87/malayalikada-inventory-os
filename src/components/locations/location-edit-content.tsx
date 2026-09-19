"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { updateLocation } from "@/app/(app)/locations/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { EditableLocation } from "@/components/locations/locations-list";

const TYPE_ITEMS: Record<string, string> = {
  warehouse: "Warehouse",
  store: "Store",
};

/**
 * The actual editable content for a location — name, type, and active
 * status. Shared, unchanged, between the desktop persistent side panel
 * (LocationEditPanel) and the mobile full-page edit route
 * (LocationEditPageContent), same split as ProductEditContent.
 *
 * No delete here — unlike deleteProduct's "danger zone" placement, deleting a
 * location is a row action on the list itself (see LocationsList), since
 * locations have far fewer fields and don't need a panel open first.
 */
export function LocationEditContent({ location }: { location: EditableLocation }) {
  const [state, formAction, pending] = useActionState(updateLocation, undefined);
  const [isActive, setIsActive] = useState(location.isActive);
  const router = useRouter();
  const idPrefix = `edit-location-${location.id}`;

  // revalidatePath() (in the server action) only invalidates the cache for
  // the *next* request to /locations — router.refresh() is what actually
  // updates this already-mounted list/panel. Same pattern as
  // ProductFieldsForm.
  useEffect(() => {
    if (state && "ok" in state) {
      router.refresh();
      toastManager.add({ title: "Location saved", type: "success" });
    }
  }, [state, router]);

  return (
    <div className="flex flex-col gap-4">
      {!location.isActive ? (
        <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          This location is inactive — it had inventory or purchase-order
          history, so it was deactivated rather than deleted. Check
          &ldquo;Active&rdquo; below to reactivate it.
        </p>
      ) : null}

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="locationId" value={location.id} />
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
            <Input
              id={`${idPrefix}-name`}
              name="name"
              defaultValue={location.name}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-type`}>Type</FieldLabel>
            <Select name="type" defaultValue={location.type} items={TYPE_ITEMS}>
              <SelectTrigger id={`${idPrefix}-type`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="store">Store</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            Active
          </label>
          {/* A real, always-submitted checkbox input — see
              price-settings-form.tsx's wholesaleUsesSameAsRetail for the same
              pattern and its rationale: Base UI's Checkbox above isn't
              guaranteed to expose a native input under this exact name. */}
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
            {pending ? "Saving…" : "Save location"}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
