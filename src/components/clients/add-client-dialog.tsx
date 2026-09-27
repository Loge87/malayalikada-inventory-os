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
import { ClientForm } from "@/components/clients/client-form";

/**
 * The "Add Client" entry point — matches AddLocationDialog/AddProductMenu's
 * placement (top-right of the page header) and button style. Clients only
 * have one creation path, so this is a plain button opening a dialog.
 */
export function AddClientDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        className="min-w-[150px] whitespace-nowrap"
        onClick={() => setOpen(true)}
      >
        Add Client
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
          <DialogDescription>
            Who stock is being handed out to — a buyer, another store, or a
            market stall.
          </DialogDescription>
        </DialogHeader>
        <ClientForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
