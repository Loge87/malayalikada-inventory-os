"use client";

import { useCameraScan } from "@/components/barcode/use-camera-scan";
import { Button } from "@/components/ui/button";
import type { ScanSource } from "@/components/barcode/types";

export function CameraScanButton({
  onScan,
  disabled = false,
}: {
  /** Same contract as BarcodeInput — fired with the decoded text and source "camera". */
  onScan: (barcode: string, source: ScanSource) => void;
  disabled?: boolean;
}) {
  const { phase, isOpen, videoRef, start, close } = useCameraScan(onScan);

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={start}
      >
        Scan with camera
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-2">
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
