"use client";

import { useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * The live camera picture for every barcode-scan screen: most of the
 * phone's screen height (a normal 16:9 box on larger screens), with a
 * focus frame on top so it's obvious where to hold the barcode — dimmed
 * surroundings, corner brackets and a scan line sweeping up and down.
 * Purely visual: decoding is still done by useCameraScan on the <video>.
 */
const PHONE_QUERY = "(max-width: 639.98px)";

function subscribePhone(callback: () => void) {
  const mql = window.matchMedia(PHONE_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/** True on a phone-sized screen. Read synchronously on the first client
 *  render, so the <video> is created once in its final place (moving it
 *  later would drop the camera stream attached to it). */
export function useIsPhone() {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false
  );
}

export function CameraViewfinder({
  videoRef,
  controls,
  hint = "Fit the barcode inside the frame",
  error = false,
  fullScreen = false,
  className,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Small buttons pinned to the top of the picture (Cancel, Light…). */
  controls?: ReactNode;
  /** Status text shown at the bottom of the picture. */
  hint?: string;
  /** Show the hint as an error. */
  error?: boolean;
  /** On a phone, cover the whole screen with the camera. */
  fullScreen?: boolean;
  className?: string;
}) {
  const isPhone = useIsPhone();
  const picture = (
    <div
      className={cn(
        "scan-viewport relative w-full overflow-hidden rounded-md bg-black sm:h-auto sm:aspect-video",
        fullScreen
          ? "max-sm:fixed max-sm:inset-0 max-sm:z-[70] max-sm:h-dvh max-sm:rounded-none"
          : "h-[calc(100dvh-14rem)]",
        className
      )}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />
      <div className="scan-frame" aria-hidden>
        <span className="scan-corner scan-corner-tl" />
        <span className="scan-corner scan-corner-tr" />
        <span className="scan-corner scan-corner-bl" />
        <span className="scan-corner scan-corner-br" />
        <span className="scan-line" />
      </div>
      {controls ? (
        <div className="absolute inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] z-10 flex items-center justify-between gap-2">{controls}</div>
      ) : null}
      <p className="scan-hint" data-error={error || undefined}>{hint}</p>
    </div>
  );

  // Full-screen on a phone: render straight into <body>, so it covers the
  // whole screen even when opened from inside a dialog (a dialog's own
  // transform would otherwise trap a fixed-position child).
  return fullScreen && isPhone ? createPortal(picture, document.body) : picture;
}
