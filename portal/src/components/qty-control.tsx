"use client";

import { useEffect, useState } from "react";

/** A compact − / number / + stepper for choosing a number of cases. */
export function QtyControl({
  value,
  onChange,
  min = 1,
  max = 999,
  disabled = false,
  label = "Cases",
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
}) {
  const clamp = (n: number) => Math.min(Math.max(Math.floor(Number.isFinite(n) ? n : min), min), max);
  // Let people type freely (including clearing the field); the value is
  // validated and committed on blur / Enter.
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() {
    const n = clamp(Number(draft));
    setDraft(String(n));
    if (n !== value) onChange(n);
  }
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-white" role="group" aria-label={label}>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full text-lg font-bold text-muted transition-colors hover:bg-soft hover:text-ink disabled:opacity-40"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          }
        }}
        className="h-9 w-12 bg-transparent text-center text-sm font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label={label}
      />
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full text-lg font-bold text-muted transition-colors hover:bg-soft hover:text-ink disabled:opacity-40"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        +
      </button>
    </div>
  );
}
