"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

/* -------------------------------------------------------------------------
 * Speed notes — why scanning is fast now:
 *  1. The phone's own barcode engine (BarcodeDetector, hardware-accelerated
 *     on Chrome/Android) is used whenever it exists.
 *  2. Everywhere else, zxing runs from a small centre crop of the frame,
 *     only for the retail formats we actually use, as fast as the device can
 *     decode (the old reader looked for a barcode just twice a second).
 *  3. The camera is asked for 1280x720 at 30fps with continuous autofocus —
 *     the default is a soft 640x480 that barcodes struggle to resolve.
 *  4. zxing is loaded lazily (and pre-loaded while idle) so opening the page
 *     is lighter and the first scan doesn't wait for a download.
 * ---------------------------------------------------------------------- */

// Retail barcode formats. QR / Data Matrix / PDF417 are left out on purpose:
// each extra format costs time on every frame.
const NATIVE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
];

type NativeDetector = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};
type NativeDetectorCtor = {
  new (options?: { formats?: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

function getNativeCtor(): NativeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
  return ctor ?? null;
}

async function createNativeDetector(): Promise<NativeDetector | null> {
  const Ctor = getNativeCtor();
  if (!Ctor) return null;
  try {
    const supported = Ctor.getSupportedFormats ? await Ctor.getSupportedFormats() : NATIVE_FORMATS;
    const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
    if (formats.length === 0) return null;
    return new Ctor({ formats });
  } catch {
    return null;
  }
}

/** Loaded on demand so the zxing bundle isn't part of the page's first load. */
function loadZxing() {
  return Promise.all([import("@zxing/browser"), import("@zxing/library")]);
}

let zxingPreload: ReturnType<typeof loadZxing> | null = null;
function preloadZxing() {
  if (!zxingPreload) zxingPreload = loadZxing();
  return zxingPreload;
}

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
  audio: false,
};

// Crop used by the zxing fallback: full width, middle band. Barcodes are
// wide and flat, so the top/bottom of the frame is wasted work.
const CROP_HEIGHT_RATIO = 0.55;
const MAX_DECODE_WIDTH = 960;

/**
 * The camera-scanning mechanics (acquire the stream synchronously in the
 * caller's click handler so iOS Safari still counts it as user-initiated,
 * decode once the <video> is mounted, clean teardown), shared by every place
 * that can start a camera scan: the self-contained CameraScanButton on /scan
 * and /stock-out, and the "Scan barcode" menu item on /products (which needs
 * the exact same gesture-preserving start() called directly from its click).
 */
export function useCameraScan(onScan: (barcode: string, source: ScanSource) => void) {
  const [phase, setPhase] = useState<CameraScanPhase>({ kind: "idle" });
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopLoopRef = useRef<(() => void) | null>(null);
  const firedRef = useRef(false);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const isOpen = phase.kind !== "idle";

  // Start fetching the fallback decoder while the browser is idle, so the
  // first scan on iPhone/Firefox doesn't wait on a download.
  useEffect(() => {
    if (getNativeCtor()) return;
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => void preloadZxing());
    else setTimeout(() => void preloadZxing(), 1500);
  }, []);

  const releaseCamera = useCallback(() => {
    stopLoopRef.current?.();
    stopLoopRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setTorchSupported(false);
    setTorchOn(false);
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
      stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
    } catch (error) {
      // Some devices reject the size/frame-rate hints outright; fall back to
      // the plain rear camera rather than failing.
      if (error instanceof DOMException && error.name === "OverconstrainedError") {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
          });
        } catch (retryError) {
          setPhase({ kind: "error", message: cameraErrorMessage(retryError) });
          return;
        }
      } else {
        setPhase({ kind: "error", message: cameraErrorMessage(error) });
        return;
      }
    }
    streamRef.current = stream;

    // Continuous autofocus (where supported) is the single biggest factor in
    // how quickly a barcode locks; torch support is surfaced as a button.
    const track = stream.getVideoTracks()[0];
    try {
      const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        focusMode?: string[];
        torch?: boolean;
      };
      if (caps.focusMode?.includes("continuous")) {
        await track.applyConstraints({
          advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
        });
      }
      setTorchSupported(Boolean(caps.torch));
    } catch {
      /* optional niceties — never block scanning */
    }

    setPhase({ kind: "scanning" });
  }, [isOpen]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      /* torch not actually available */
    }
  }, [torchOn]);

  // Run the decoder once the <video> is mounted and the stream is ready.
  useEffect(() => {
    if (phase.kind !== "scanning") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rafId: number | undefined;

    video.srcObject = stream;
    void video.play().catch(() => {
      /* autoplay is allowed for muted inline video; ignore the rare refusal */
    });

    const found = (text: string) => {
      if (cancelled || firedRef.current || !text) return;
      firedRef.current = true;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(40);
      }
      onScanRef.current(text, "camera");
      close();
    };

    // Next attempt: right after the next painted video frame when the browser
    // can tell us (requestVideoFrameCallback), otherwise a short timer.
    const schedule = (fn: () => void) => {
      if (cancelled) return;
      const v = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
      };
      if (v.requestVideoFrameCallback) {
        v.requestVideoFrameCallback(fn);
      } else {
        rafId = requestAnimationFrame(() => {
          timer = setTimeout(fn, 30);
        });
      }
    };

    const run = async () => {
      const native = await createNativeDetector();
      if (cancelled) return;

      if (native) {
        const tick = async () => {
          if (cancelled) return;
          if (video.readyState >= 2) {
            try {
              const codes = await native.detect(video);
              if (codes.length > 0) {
                found(codes[0].rawValue);
                return;
              }
            } catch {
              /* a bad frame — try the next one */
            }
          }
          schedule(tick);
        };
        schedule(tick);
        return;
      }

      // Fallback: zxing on a centre crop, retail formats only.
      let zx: Awaited<ReturnType<typeof loadZxing>>;
      try {
        zx = await preloadZxing();
      } catch {
        if (!cancelled) setPhase({ kind: "error", message: "Could not load the barcode scanner." });
        return;
      }
      if (cancelled) return;
      const [{ BrowserMultiFormatReader, BarcodeFormat }, { DecodeHintType }] = zx;
      const hints = new Map<unknown, unknown>([
        [
          DecodeHintType.POSSIBLE_FORMATS,
          [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.ITF,
          ],
        ],
      ]);
      const reader = new BrowserMultiFormatReader(hints as never);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setPhase({ kind: "error", message: "Could not start the barcode scanner." });
        return;
      }

      const tick = () => {
        if (cancelled) return;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw > 0 && vh > 0) {
          const cropH = Math.round(vh * CROP_HEIGHT_RATIO);
          const sy = Math.round((vh - cropH) / 2);
          const scale = Math.min(1, MAX_DECODE_WIDTH / vw);
          canvas.width = Math.round(vw * scale);
          canvas.height = Math.round(cropH * scale);
          ctx.drawImage(video, 0, sy, vw, cropH, 0, 0, canvas.width, canvas.height);
          try {
            found(reader.decodeFromCanvas(canvas).getText());
            if (firedRef.current) return;
          } catch {
            /* NotFoundException on most frames — expected */
          }
        }
        schedule(tick);
      };
      schedule(tick);
    };

    void run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      video.srcObject = null;
    };
  }, [phase.kind, close]);

  // Always release the camera on unmount.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { phase, isOpen, videoRef, start, close, torchSupported, torchOn, toggleTorch };
}
