"use client";

import { useCameraScan } from "@/components/barcode/use-camera-scan";
import { CameraViewfinder } from "@/components/barcode/camera-viewfinder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScanSource } from "@/components/barcode/types";

export function CameraScanButton({
  onScan,
  disabled = false,
  emphasized = false,
}: {
  /** Same contract as BarcodeInput — fired with the decoded text and source "camera". */
  onScan: (barcode: string, source: ScanSource) => void;
  disabled?: boolean;
  /** /stock-out only — this is the main action on that page (mobile scan
   *  view especially), so it gets the solid primary-filled trigger button
   *  and a taller, less padded preview than the compact outline treatment
   *  /scan and AddProductMenu keep by default. Opt-in so neither of those
   *  changes visually. */
  emphasized?: boolean;
}) {
  const { phase, isOpen, videoRef, start, close, torchSupported, torchOn, toggleTorch } =
    useCameraScan(onScan);

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant={emphasized ? "default" : "outline"}
        size={emphasized ? "default" : "sm"}
        disabled={disabled}
        onClick={start}
        className={emphasized ? "w-full sm:w-auto" : undefined}
      >
        Scan with camera
      </Button>
    );
  }

  return (
    // w-full explicitly, not just relying on a flex-col parent's stretch —
    // needed once this sits inside a flex-ROW layout (stock-out-lookup.tsx's
    // input+button row), where a plain flex item has no reason to claim the
    // full row's width on its own. Harmless here in /scan's flex-col layout,
    // which already stretched this the same way by default.
    <div
      className={cn(
        "flex w-full flex-col rounded-lg border border-border",
        emphasized ? "gap-1.5 p-1.5" : "gap-2 p-2"
      )}
    >
      <CameraViewfinder
        videoRef={videoRef}
        fullScreen
        error={phase.kind === "error"}
        hint={
          phase.kind === "error"
            ? phase.message
            : phase.kind === "requesting"
              ? "Starting camera…"
              : "Fit the barcode inside the frame"
        }
        controls={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-black/50 text-white backdrop-blur hover:bg-black/70"
              onClick={close}
            >
              Cancel
            </Button>
            {torchSupported ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-black/50 text-white backdrop-blur hover:bg-black/70"
                aria-pressed={torchOn}
                onClick={toggleTorch}
              >
                {torchOn ? "Light off" : "Light on"}
              </Button>
            ) : null}
          </>
        }
      />
    </div>
  );
}
