"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LocationForm } from "@/components/locations/location-form";

/**
 * The "Add Location" entry point — matches AddProductMenu's placement
 * (top-right of the page header) and button style. Locations only have one
 * creation path (no scan/manual/bulk split like products), so this is a
 * plain button opening a dialog rather than a dropdown.
 */
export function AddLocationDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        className="min-w-[150px] whitespace-nowrap"
        onClick={() => setOpen(true)}
      >
        Add Location
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New location</DialogTitle>
          <DialogDescription>
            Add a warehouse or store to your organisation.
          </DialogDescription>
        </DialogHeader>
        <LocationForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
