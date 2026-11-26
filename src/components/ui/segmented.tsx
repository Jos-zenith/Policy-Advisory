"use client";
import { cn } from "@/lib/cn";

/** Two-or-more option toggle, rendered as a radio group for keyboard users. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid overflow-hidden rounded-xl border border-line bg-white", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o, idx) => {
        const active = o.value === value;
        const focusable = active || (idx === 0 && !options.some((x) => x.value === value));
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value);
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                onChange(options[(i + 1) % options.length].value);
              }
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                onChange(options[(i - 1 + options.length) % options.length].value);
              }
            }}
            tabIndex={focusable ? 0 : -1}
            className={cn("font-medium transition-colors", size === "lg" ? "h-12 text-base" : "h-11 text-[15px]", active ? "bg-ink text-white" : "text-ink hover:bg-bg-alt")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
