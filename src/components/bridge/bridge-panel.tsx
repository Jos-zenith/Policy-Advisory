"use client";
import { setQueryParam } from "@/lib/hooks";

/** Existing-policy bridge (FR-6.1). Filled in Phase 6. */
export function BridgePanel() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 md:px-8">
      <button type="button" className="font-semibold text-blue" onClick={() => setQueryParam("panel", null)}>
        ← Back to options
      </button>
    </div>
  );
}
