"use client";
import { Minus, Plus } from "lucide-react";

/** ± stepper used in "Adjust assumptions". */
export function StepperInput({
  display,
  onDec,
  onInc,
  label,
  canDec = true,
  canInc = true,
}: {
  display: string;
  onDec: () => void;
  onInc: () => void;
  label: string;
  canDec?: boolean;
  canInc?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onDec} disabled={!canDec} aria-label={`Decrease ${label}`} className="grid size-8 place-items-center rounded-lg border border-line bg-white text-ink hover:bg-bg-alt disabled:opacity-40">
        <Minus className="size-4" />
      </button>
      <output aria-live="polite" aria-label={label} className="num w-14 text-center font-semibold">
        {display}
      </output>
      <button type="button" onClick={onInc} disabled={!canInc} aria-label={`Increase ${label}`} className="grid size-8 place-items-center rounded-lg border border-line bg-white text-ink hover:bg-bg-alt disabled:opacity-40">
        <Plus className="size-4" />
      </button>
    </div>
  );
}
