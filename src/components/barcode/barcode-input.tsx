"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { ScanSource } from "@/components/barcode/types";

export type { ScanSource };

// A hardware scanner types a whole barcode in a few milliseconds per character
// and finishes with Enter. A person is an order of magnitude slower, so an
// average inter-key gap at or below this is treated as a scan rather than typing.
const SCANNER_AVG_INTERKEY_MS = 40;
const SCANNER_MIN_LENGTH = 3;
// A pause longer than this mid-entry means a human — restart the timing window.
const IDLE_RESET_MS = 400;

type Timing = { startedAt: number; lastAt: number; keystrokes: number };
const emptyTiming: Timing = { startedAt: 0, lastAt: 0, keystrokes: 0 };

export function BarcodeInput({
  onScan,
  autoFocus = true,
  keepFocus = autoFocus,
  disabled = false,
  placeholder = "Scan or type a barcode",
  className,
}: {
  /** Fired on Enter with the trimmed value. `source` is "scan" when the keystroke
   *  timing matched a hardware scanner, "manual" when it was typed or pasted. */
  onScan: (barcode: string, source: ScanSource) => void;
  autoFocus?: boolean;
  /** Pull focus back to the field when the window regains focus. */
  keepFocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timingRef = useRef<Timing>(emptyTiming);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!keepFocus) return;
    const refocus = () => {
      if (!disabled && document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("focus", refocus);
    return () => window.removeEventListener("focus", refocus);
  }, [keepFocus, disabled]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      const barcode = value.trim();
      if (barcode.length === 0) {
        return;
      }

      const t = timingRef.current;
      const avgGap =
        t.keystrokes > 1
          ? (t.lastAt - t.startedAt) / (t.keystrokes - 1)
          : Number.POSITIVE_INFINITY;
      const looksLikeScan =
        barcode.length >= SCANNER_MIN_LENGTH &&
        avgGap <= SCANNER_AVG_INTERKEY_MS;

      onScan(barcode, looksLikeScan ? "scan" : "manual");
      setValue("");
      timingRef.current = emptyTiming;
      return;
    }

    // Track timing for single-character (printable) keys only.
    if (event.key.length === 1) {
      const now = performance.now();
      const t = timingRef.current;
      if (t.lastAt === 0 || now - t.lastAt > IDLE_RESET_MS) {
        timingRef.current = { startedAt: now, lastAt: now, keystrokes: 1 };
      } else {
        timingRef.current = {
          startedAt: t.startedAt,
          lastAt: now,
          keystrokes: t.keystrokes + 1,
        };
      }
    }
  }

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="text"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      className={cn("font-mono", className)}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
    />
  );
}
