import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  warn: "bg-warn-bg text-warn-ink",
  green: "bg-green-bg text-green-ink",
  blue: "bg-blue-soft text-blue",
  neutral: "bg-blue-soft text-muted",
  locked: "bg-locked text-muted",
  dark: "bg-ink text-white",
} as const;

export type PillTone = keyof typeof tones;

export function Pill({ tone = "neutral", children, className, icon }: { tone?: PillTone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium leading-5", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
