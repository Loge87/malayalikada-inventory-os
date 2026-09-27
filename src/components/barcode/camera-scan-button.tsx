"use client";

import { useCameraScan } from "@/components/barcode/use-camera-scan";
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
  const { phase, isOpen, videoRef, start, close } = useCameraScan(onScan);

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
      <video
        ref={videoRef}
        className={cn(
          "w-full rounded-md bg-black object-cover",
          // Taller on /stock-out's mobile scan view specifically — more of
          // the viewport is the actual scan target, less surrounding chrome
          // — reverting to the original 16:9 preview from sm: up, where
          // there's already plenty of room either way.
          emphasized ? "aspect-[3/4] sm:aspect-video" : "aspect-video"
        )}
        playsInline
        muted
        autoPlay
      />
      {phase.kind === "error" ? (
        <p className="text-sm text-destructive">{phase.message}</p>
      ) : (
        <p className="text-muted-foreground text-xs">
          {phase.kind === "requesting"
            ? "Requesting camera…"
            : "Point the camera at a barcode."}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={close}
      >
        Cancel
      </Button>
    </div>
  );
}
