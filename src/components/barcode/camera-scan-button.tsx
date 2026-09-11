"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ScanSource } from "@/components/barcode/types";

type Phase =
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "error"; message: string };

function errorMessage(error: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Camera scanning needs https (or localhost). It works in the deployed app and the mobile app.";
  }
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
        return "Camera access was denied. Allow it in your browser settings, then try again.";
      case "NotFoundError":
        return "No camera was found on this device.";
      case "NotReadableError":
        return "The camera is already in use by another app.";
      case "SecurityError":
        return "The camera needs a secure (https) connection.";
    }
  }
  return "Could not start the camera.";
}

export function CameraScanButton({
  onScan,
  disabled = false,
}: {
  /** Same contract as BarcodeInput — fired with the decoded text and source "camera". */
  onScan: (barcode: string, source: ScanSource) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;

    // On mobile the BarcodeInput may hold focus and the on-screen keyboard —
    // drop it before showing the camera.
    (document.activeElement as HTMLElement | null)?.blur();

    let cancelled = false;
    let controls: { stop: () => void } | null = null;
    let fired = false;

    void (async () => {
      try {
        // Dynamic import: the decoder is browser-only and heavy, so it stays
        // out of the server render and off the critical path.
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        const activeControls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (result) => {
            if (!result || fired || cancelled) return;
            fired = true;
            activeControls.stop();
            onScan(result.getText(), "camera");
            setOpen(false);
          }
        );

        controls = activeControls;
        if (cancelled) {
          activeControls.stop();
          return;
        }
        setPhase({ kind: "scanning" });
      } catch (error) {
        if (!cancelled) {
          setPhase({ kind: "error", message: errorMessage(error) });
        }
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [open, onScan]);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setPhase({ kind: "starting" });
          setOpen(true);
        }}
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
      />
      {phase.kind === "error" ? (
        <p className="text-sm text-destructive">{phase.message}</p>
      ) : (
        <p className="text-muted-foreground text-xs">
          {phase.kind === "scanning"
            ? "Point the camera at a barcode."
            : "Starting camera…"}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
    </div>
  );
}
