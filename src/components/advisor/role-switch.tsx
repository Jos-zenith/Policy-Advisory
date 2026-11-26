"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import advisorsJson from "@/data/canonical/advisors.json";
import { cn } from "@/lib/cn";

/** Demo sign-in, not real authentication: sets a role cookie. */
export function RoleSwitch({ current, compact = false }: { current: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function set(body: object) {
    setBusy(true);
    await fetch("/api/demo-role", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    router.refresh();
  }
  const options = [...advisorsJson.advisors.map((a) => ({ value: `advisor:${a.id}`, label: `${a.name} · Advisor` })), { value: "compliance", label: "Compliance reviewer" }];
  return (
    <div className={cn("flex flex-wrap items-center gap-2", compact ? "text-[13px]" : "text-[14px]")}>
      <label className="flex items-center gap-2">
        <span className="font-medium">Demo sign-in</span>
        <select
          disabled={busy}
          value={current}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") set({ role: "none" });
            else if (v === "compliance") set({ role: "compliance" });
            else set({ role: "advisor", advisorId: v.split(":")[1] });
          }}
          className="h-9 rounded-lg border border-line bg-white px-2 text-ink"
        >
          <option value="">Signed out</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <span className="rounded bg-warn-bg px-2 py-0.5 text-[12px] font-medium text-warn-ink">Demo sign-in, not real authentication</span>
    </div>
  );
}
