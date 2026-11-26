"use client";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import glossary from "@/config/content/glossary.json";

export type GlossaryKey = keyof typeof glossary.terms;

/** A jargon word with a plain-language tooltip from the glossary (P9). Keyboard focusable. */
export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const t = glossary.terms[k];
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>
        <button type="button" className="cursor-help border-b border-dotted border-muted-2 text-inherit" aria-label={`${t.term}: ${t.plain}`}>
          {children ?? t.term}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="top" sideOffset={6} className="z-[60] max-w-xs rounded-xl bg-ink px-3 py-2 text-[13px] leading-5 text-white shadow-[var(--shadow-float)]">
          <span className="font-semibold">{t.term}.</span> {t.plain}
          <Tooltip.Arrow className="fill-ink" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <Tooltip.Provider>{children}</Tooltip.Provider>;
}
