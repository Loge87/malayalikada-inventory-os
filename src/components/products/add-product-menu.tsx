"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronDown, PencilLine, Upload } from "lucide-react";

import { BarcodeInput } from "@/components/barcode/barcode-input";
import { useCameraScan } from "@/components/barcode/use-camera-scan";
import { Button } from "@/components/ui/button";
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
 * page first; a successful scan lands on the same create form, pre-filled.
 */
export function AddProductMenu() {
  const router = useRouter();
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  function handleScan(barcode: string) {
    router.push(`/products/new?barcode=${encodeURIComponent(barcode)}`);
  }

  const { phase, isOpen, videoRef, start, close } = useCameraScan(handleScan);

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
          <DropdownMenuItem onClick={start}>
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
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className="sm:max-w-md" initialFocus={barcodeInputRef}>
          <DialogHeader>
            <DialogTitle>Scan barcode</DialogTitle>
          </DialogHeader>
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
          {/* A hardware scanner emulates a keyboard — it needs a focused text
              input to type into, which the camera view alone doesn't provide.
              Keeping this focused (matching /scan) means a USB/Bluetooth
              scanner works from this same dialog, camera permission or not. */}
          <BarcodeInput
            ref={barcodeInputRef}
            onScan={(barcode) => handleScan(barcode)}
            placeholder="Or scan with a hardware reader / type a barcode"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
