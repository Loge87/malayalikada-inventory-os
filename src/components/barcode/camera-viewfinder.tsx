"use client";

import type { ReactNode, RefObject } from "react";

import { cn } from "@/lib/utils";

/**
 * The live camera picture for every barcode-scan screen: about 75% of the
 * phone's screen height (a normal 16:9 box on larger screens), with a
 * focus frame on top so it's obvious where to hold the barcode — dimmed
 * surroundings, corner brackets and a scan line sweeping up and down.
 * Purely visual: decoding is still done by useCameraScan on the <video>.
 */
export function CameraViewfinder({
  videoRef,
  controls,
  hint = "Fit the barcode inside the frame",
  className,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Small buttons pinned to the top of the picture (Cancel, Light…). */
  controls?: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "scan-viewport relative h-[75dvh] w-full overflow-hidden rounded-md bg-black sm:h-auto sm:aspect-video",
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
        <div className="absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-2">{controls}</div>
      ) : null}
      <p className="scan-hint">{hint}</p>
    </div>
  );
}
