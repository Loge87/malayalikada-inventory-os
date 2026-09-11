"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

import { Button } from "@/components/ui/button";
import type { ScanSource } from "@/components/barcode/types";

type Phase =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "scanning" }
  | { kind: "error"; message: string };

function errorMessage(error: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Camera scanning needs https (or localhost). It works in the deployed app and the mobile app.";
  }
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "Camera access was denied. Allow the camera for this site, then try again.";
      case "NotFoundError":
      case "OverconstrainedError":
        return "No usable camera was found on this device.";
      case "NotReadableError":
        return "The camera is already in use by another app.";
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
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const firedRef = useRef(false);

  const open = phase.kind !== "idle";

  const releaseCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const close = useCallback(() => {
    releaseCamera();
    setPhase({ kind: "idle" });
  }, [releaseCamera]);

  // Acquire the stream synchronously in the tap handler — the browser only
  // treats getUserMedia as user-initiated when it is called before any `await`
  // in the gesture (iOS Safari enforces this strictly).
  async function start() {
    if (open) return;
    firedRef.current = false;
    (document.activeElement as HTMLElement | null)?.blur();
    setPhase({ kind: "requesting" });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
    } catch (error) {
      setPhase({ kind: "error", message: errorMessage(error) });
      return;
    }
    streamRef.current = stream;
    setPhase({ kind: "scanning" });
  }

  // Run the decoder once the <video> is mounted and the stream is ready.
  useEffect(() => {
    if (phase.kind !== "scanning" || !videoRef.current || !streamRef.current) {
      return;
    }

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromStream(streamRef.current, videoRef.current, (result) => {
        if (!result || firedRef.current || cancelled) return;
        firedRef.current = true;
        onScan(result.getText(), "camera");
        close();
      })
      .then((controls) => {
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      })
      .catch((error) => {
        if (!cancelled) {
          setPhase({ kind: "error", message: errorMessage(error) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [phase.kind, onScan, close]);

  // Always release the camera on unmount.
  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (!open) {
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
