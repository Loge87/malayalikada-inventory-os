"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

import type { ScanSource } from "@/components/barcode/types";

export type CameraScanPhase =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "scanning" }
  | { kind: "error"; message: string };

export function cameraErrorMessage(error: unknown): string {
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

/**
 * The camera-scanning mechanics (acquire the stream synchronously in the
 * caller's click handler so iOS Safari still counts it as user-initiated,
 * decode via zxing once the <video> is mounted, clean teardown), shared by
 * every place that can start a camera scan: the self-contained CameraScanButton
 * on /scan, and the "Scan barcode" menu item on /products (which needs the
 * exact same gesture-preserving start() called directly from its own click).
 */
export function useCameraScan(onScan: (barcode: string, source: ScanSource) => void) {
  const [phase, setPhase] = useState<CameraScanPhase>({ kind: "idle" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const firedRef = useRef(false);

  const isOpen = phase.kind !== "idle";

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

  // Acquire the stream synchronously in the caller's tap handler — the
  // browser only treats getUserMedia as user-initiated when it is called
  // before any `await` in the gesture (iOS Safari enforces this strictly).
  const start = useCallback(async () => {
    if (isOpen) return;
    firedRef.current = false;
    (document.activeElement as HTMLElement | null)?.blur();
    setPhase({ kind: "requesting" });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
    } catch (error) {
      setPhase({ kind: "error", message: cameraErrorMessage(error) });
      return;
    }
    streamRef.current = stream;
    setPhase({ kind: "scanning" });
  }, [isOpen]);

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
          setPhase({ kind: "error", message: cameraErrorMessage(error) });
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

  return { phase, isOpen, videoRef, start, close };
}
