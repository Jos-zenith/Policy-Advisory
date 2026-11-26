import ui from "@/config/content/ui.json";
import { cn } from "@/lib/cn";

/** Famsurance mark + wordmark; the tagline shows from large screens up so the phone header stays within 360 px. */
export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 36 36" className="size-8 md:size-9" aria-hidden="true">
        <circle cx="18" cy="18" r="17" fill="#1e4fbf" />
        <path d="M1 18a17 17 0 0 0 34 0Z" fill="#0e1530" />
        <circle cx="18" cy="18" r="8" fill="#fff" />
        <circle cx="18" cy="18" r="4.5" fill="#0e1530" />
      </svg>
      <span className="flex flex-col max-[399px]:sr-only">
        <span className={cn("font-display text-[17px] font-bold leading-5 tracking-[0.02em] md:text-lg", dark ? "text-white" : "text-ink")}>{ui.brand}</span>
        <span className={cn("hidden text-[10px] font-semibold uppercase leading-3 tracking-[0.16em] lg:block", dark ? "text-white/70" : "text-muted-2")}>{ui.tagline}</span>
      </span>
    </span>
  );
}
