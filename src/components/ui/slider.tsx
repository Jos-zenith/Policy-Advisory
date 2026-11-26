"use client";
import * as RSlider from "@radix-ui/react-slider";
import { cn } from "@/lib/cn";

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  label,
  valueText,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  label: string;
  valueText: string;
  className?: string;
}) {
  return (
    <RSlider.Root
      className={cn("relative flex h-6 w-full touch-none select-none items-center", className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onChange(v[0])}
      onValueCommit={(v) => onCommit?.(v[0])}
    >
      <RSlider.Track className="relative h-1.5 grow rounded-full bg-line">
        <RSlider.Range className="absolute h-full rounded-full bg-ink" />
      </RSlider.Track>
      <RSlider.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className="block size-5 rounded-full border-2 border-white bg-ink shadow ring-1 ring-ink/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-mid"
      />
    </RSlider.Root>
  );
}
