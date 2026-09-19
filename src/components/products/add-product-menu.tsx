"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronDown, PencilLine, Upload } from "lucide-react";

import { checkBarcodeExists } from "@/app/(app)/products/actions";
import { BarcodeInput } from "@/components/barcode/barcode-input";
import { useCameraScan } from "@/components/barcode/use-camera-scan";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The single "Add product" entry point: a split button whose three options
 * (scan / manual / bulk upload) replace the old intermediate choice page.
 * "Scan barcode" starts the camera directly from this click (useCameraScan
 * requires that — see its docstring), showing the scanner in a centered
 * dialog right here on /products rather than navigating to an explanatory
 * page first; a successful scan lands on the same create form, pre-filled —
 * unless that barcode already belongs to a product, in which case this
 * dialog says so immediately and never navigates anywhere.
 */
export function AddProductMenu() {
  const router = useRouter();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(false);
  const [duplicate, setDuplicate] = useState<
    { productId: string; productName: string } | null
  >(null);
  // Deliberately separate from useCameraScan's own `isOpen`: that hook
  // calls its internal close() the instant a decode succeeds — synchronous,
  // before this component's async handleScan below even starts — which
  // would otherwise collapse this dialog right as the duplicate check is
  // still in flight, before there's anything to show. This dialog's own
  // open/closed state is ours alone; the hook still owns the camera
  // stream/phase underneath it.
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fires for BOTH inputs in the dialog below — the camera (via
  // useCameraScan) and BarcodeInput (hardware scanner or manual typing,
  // Enter-triggered) — so one check here covers all three input methods at
  // once, immediately on capture, before ever navigating to the create
  // form. Same checkBarcodeExists() the create form's own barcode field
  // uses — one shared implementation (see products/actions.ts).
  async function handleScan(barcode: string) {
    setChecking(true);
    const result = await checkBarcodeExists(barcode);
    setChecking(false);
    if (result.exists) {
      setDuplicate(result);
      return;
    }
    setDialogOpen(false);
    router.push(`/products/new?barcode=${encodeURIComponent(barcode)}`);
  }

  const { phase, videoRef, start, close } = useCameraScan(handleScan);

  function openDialog() {
    setDuplicate(null);
    setDialogOpen(true);
    start();
  }

  function closeDialog() {
    setDuplicate(null);
    setDialogOpen(false);
    close();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button className="min-w-[150px] whitespace-nowrap">
              Add product
              <ChevronDown className="size-4" />
            </Button>
          }
        />
        {/* w-56, not the default w-(--anchor-width) — the popup normally
            matches the trigger's own width exactly, which is comfortable
            for the compact button above but cramped for these items
            (icon + "Enter manually"/"Bulk upload" need more room than a
            ~150px button does). Sized for the items' own content instead
            of being tied to the trigger. */}
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={openDialog}>
            <Camera className="size-4" />
            Scan barcode
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/products/new")}>
            <PencilLine className="size-4" />
            Enter manually
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push("/products/bulk-upload")}
          >
            <Upload className="size-4" />
            Bulk upload
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-md" initialFocus={barcodeInputRef}>
          <DialogHeader>
            <DialogTitle>Scan barcode</DialogTitle>
          </DialogHeader>

          {duplicate ? (
            <>
              <p className="text-sm text-status-warning">
                This product already exists ({duplicate.productName}).
              </p>
              <div className="flex gap-2">
                <Link
                  href={`/products/${duplicate.productId}/edit`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  View existing product
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDuplicate(null);
                    // The camera stream was already released right after
                    // the decode that found this duplicate (useCameraScan's
                    // own close(), independent of this dialog) — needs a
                    // fresh start(), not just clearing this state.
                    start();
                  }}
                >
                  Scan a different barcode
                </Button>
              </div>
            </>
          ) : checking ? (
            // The camera stream is already released by this point
            // (useCameraScan's own close(), fired the instant it decoded
            // something — before this check even started) — showing the
            // now-frozen <video> here would be misleading, so this is its
            // own branch rather than layering "Checking…" text over it.
            <p className="text-muted-foreground text-sm">Checking…</p>
          ) : (
            <>
              <video
                ref={videoRef}
                className="aspect-video w-full rounded-md bg-black object-cover"
                playsInline
                muted
                autoPlay
              />
              {phase.kind === "error" ? (
                <p className="text-sm text-destructive">{phase.message}</p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {phase.kind === "requesting"
                    ? "Requesting camera…"
                    : "Point the camera at a barcode."}
                </p>
              )}
              {/* A hardware scanner emulates a keyboard — it needs a focused
                  text input to type into, which the camera view alone
                  doesn't provide. Keeping this focused (matching /scan)
                  means a USB/Bluetooth scanner works from this same dialog,
                  camera permission or not. */}
              <BarcodeInput
                ref={barcodeInputRef}
                onScan={(barcode) => handleScan(barcode)}
                placeholder="Or scan with a hardware reader / type a barcode"
              />
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
