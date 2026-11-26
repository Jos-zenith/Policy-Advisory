"use client";
import { useId, useState } from "react";
import { groupIndian, inr } from "@/engine";
import { cn } from "@/lib/cn";

/** Rupee input with Indian grouping and a compact lakh/crore hint. Value in rupees; null = empty. */
export function MoneyField({
  label,
  value,
  onChange,
  className,
  hideLabel = false,
  invalid,
  hint,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  className?: string;
  hideLabel?: boolean;
  invalid?: boolean;
  hint?: string;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const shown = focused ? draft : value === null || value === undefined ? "" : groupIndian(value);
  return (
    <div className={className}>
      <label htmlFor={id} className={cn("block text-[13px] font-medium text-muted", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className={cn("relative", !hideLabel && "mt-1")}>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2">₹</span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={shown}
          aria-invalid={invalid || undefined}
          onFocus={() => {
            setDraft(value === null || value === undefined ? "" : String(value));
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d]/g, "");
            setDraft(raw);
            onChange(raw === "" ? null : Number(raw));
          }}
          className={cn("num h-11 w-full rounded-xl border bg-white pl-7 pr-3 outline-none focus:border-blue-mid", invalid ? "border-warn" : "border-line")}
        />
      </div>
      <p className="mt-1 min-h-4 text-[12px] text-muted-2">{hint ?? (value && value >= 100_000 ? inr(value) : "")}</p>
    </div>
  );
}

export function TextField({ label, value, onChange, className, hideLabel = false }: { label: string; value: string; onChange: (v: string) => void; className?: string; hideLabel?: boolean }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={cn("block text-[13px] font-medium text-muted", hideLabel && "sr-only")}>
        {label}
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn("h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-blue-mid", !hideLabel && "mt-1")} />
    </div>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange, className, hideLabel = false }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string; hideLabel?: boolean }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={cn("block text-[13px] font-medium text-muted", hideLabel && "sr-only")}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={cn("h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-blue-mid", !hideLabel && "mt-1")}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
