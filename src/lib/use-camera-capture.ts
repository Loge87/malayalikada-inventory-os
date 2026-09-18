"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cameraErrorMessage } from "@/components/barcode/use-camera-scan";

export type CameraCapturePhase =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "live" }
  | { kind: "error"; message: string };

/**
 * Opens the camera for a live preview and lets the caller grab a single
 * still frame as a File — the same gesture-preserving start() mechanics as
 * useCameraScan (acquire getUserMedia synchronously in the click handler, so
 * iOS Safari still treats it as user-initiated), but capturing one photo on
 * demand instead of continuously decoding a barcode. Shared by the product
 * create and edit forms' "Take photo" option.
 */
export function useCameraCapture() {
  const [phase, setPhase] = useState<CameraCapturePhase>({ kind: "idle" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isOpen = phase.kind !== "idle";

  const releaseCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const close = useCallback(() => {
    releaseCamera();
    setPhase({ kind: "idle" });
  }, [releaseCamera]);

  const start = useCallback(async () => {
    if (isOpen) return;
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
    setPhase({ kind: "live" });
  }, [isOpen]);

  // Attach the stream once the <video> is mounted for it.
  useEffect(() => {
    if (phase.kind !== "live" || !videoRef.current || !streamRef.current) {
      return;
    }
    videoRef.current.srcObject = streamRef.current;
  }, [phase.kind]);

  // Always release the camera on unmount.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  /** Draws the current video frame to an offscreen canvas and returns it as
   *  a JPEG File — null if the video isn't actually producing frames yet. */
  const capture = useCallback(async (): Promise<File | null> => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
    );
    if (!blob) return null;

    return new File([blob], `product-photo-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
  }, []);

  return { phase, isOpen, videoRef, start, close, capture };
}
