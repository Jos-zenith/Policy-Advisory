"use client";
import { useJudge } from "@/lib/judge-store";
import { useMounted } from "@/lib/hooks";
import { cn } from "@/lib/cn";

/** Hydration-safe judge-mode flag (localStorage is only read on the client). */
export function useJudgeOn(): boolean {
  const on = useJudge((s) => s.on);
  const mounted = useMounted();
  return mounted && on;
}

/** Requirement / rule / assumption ID chip. Rendered only in Judge mode. */
export function Trace({ id, className, label }: { id: string | string[]; className?: string; label?: string }) {
  const on = useJudgeOn();
  if (!on) return null;
  const text = Array.isArray(id) ? id.join(" · ") : id;
  return (
    <span data-judge-chip className={cn("chip-id whitespace-nowrap", className)} title={label ?? "Trace ID (judge mode)"}>
      {text}
    </span>
  );
}
