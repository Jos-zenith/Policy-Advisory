import ui from "@/config/content/ui.json";
import { cn } from "@/lib/cn";

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 36 36" className="size-8 md:size-9" aria-hidden="true">
        <circle cx="18" cy="18" r="17" fill="#1e4fbf" />
        <path d="M1 18a17 17 0 0 0 34 0Z" fill="#0e1530" />
        <circle cx="18" cy="18" r="8" fill="#fff" />
        <circle cx="18" cy="18" r="4.5" fill="#0e1530" />
      </svg>
      <span className={cn("font-display text-[17px] font-bold tracking-[0.02em] md:text-lg", dark ? "text-white" : "text-ink")}>{ui.brand}</span>
    </span>
  );
}
