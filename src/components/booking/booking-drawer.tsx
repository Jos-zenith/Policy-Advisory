"use client";
import type { RulesOutcome } from "@/engine";
import { Sheet } from "@/components/ui/sheet";

/** Stage 4 booking drawer. Filled in Phase 5. */
export function BookingDrawer({ onClose }: { rules: RulesOutcome; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Book a free 30-minute call" full width="md:max-w-[960px]">
      <p className="text-muted">Coming in the next phase.</p>
    </Sheet>
  );
}
