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
import {
  TransferForm,
  type LocationOption,
  type VariantOption,
} from "@/components/transfers/transfer-form";

/**
 * The "New transfer" entry point — matches AddClientDialog/AddLocationDialog's
 * placement (top-right of the page header) and button style (item 9: the
 * same page-header shape as Clients/Teams, not the form sitting directly on
 * the page the way it used to).
 */
export function NewTransferDialog({
  locations,
  variants,
}: {
  locations: LocationOption[];
  variants: VariantOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        className="min-w-[150px] whitespace-nowrap"
        onClick={() => setOpen(true)}
      >
        New transfer
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New stock transfer</DialogTitle>
          <DialogDescription>
            Moves stock between two locations as a single ledger event —
            TRANSFER_OUT at the source and TRANSFER_IN at the destination.
          </DialogDescription>
        </DialogHeader>
        <TransferForm
          locations={locations}
          variants={variants}
          onCreated={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
