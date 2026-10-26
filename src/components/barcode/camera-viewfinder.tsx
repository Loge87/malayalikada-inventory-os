"use client";

import type { ReactNode, RefObject } from "react";

import { cn } from "@/lib/utils";

/**
 * The live camera picture for every barcode-scan screen: most of the
 * phone's screen height (a normal 16:9 box on larger screens), with a
 * focus frame on top so it's obvious where to hold the barcode — dimmed
 * surroundings, corner brackets and a scan line sweeping up and down.
 * Purely visual: decoding is still done by useCameraScan on the <video>.
 */
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
  return (
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
}
