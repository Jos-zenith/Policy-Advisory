/**
 * Reconciliation: gross needs − offsets = gap (CLAUDE.md §8).
 *
 *   Offsets = own death cover + employer cover + allocated liquid assets (each once)
 *   Gap     = Gross needs − Offsets        (negative ⇒ surplus, "adequately covered")
 *
 * Allocation rules: each asset is allocated to at most one need, never above its
 * value, and never above what that need still requires. Retirement assets are
 * only used if the customer explicitly allocates them (default "not used").
 */
import { input, makeExplain, q, step } from "./explain";
import { NEED_TARGET_LABELS, type NeedKey } from "./labels";
import type { NeedsResult } from "./needs";
import type { EngineConfig, Explain, Flag, Profile } from "./types";

export interface AssetAllocation {
  index: number;
  label: string;
  value: number;
  kind: "LIQUID" | "RETIREMENT";
  target: NeedKey | null;
  allocated: number;
  unused: number;
  note: "USED" | "TRIMMED" | "NOT_USED" | "RETIREMENT_DEFAULT" | "NO_SUCH_NEED";
}

export type OffsetKey = "OWN" | "EMPLOYER" | "ASSETS";

export interface OffsetSegment {
  key: OffsetKey;
  label: string;
  amount: number;
  explain: Explain;
}

export interface Reconciliation {
  gross: number;
  offsets: OffsetSegment[];
  totalOffsets: number;
  gap: number;
  state: "GAP" | "COVERED";
  allocations: AssetAllocation[];
  /** Waterfall check: Σ needs − Σ offsets − gap (should be 0 up to float noise). */
  checkResidual: number;
  explain: Explain;
  flags: Flag[];
}

const isNeedKey = (k: string, keys: Set<string>): k is NeedKey => keys.has(k);

export function allocateAssets(p: Profile, needs: NeedsResult): AssetAllocation[] {
  const remaining = new Map<string, number>(needs.components.map((x) => [x.key, x.amount]));
  const keys = new Set<string>(["LOANS", "LIVING", "EDUCATION", "MARRIAGE", "HEALTH_EMERGENCY", "SPOUSE_RETIREMENT", "OTHER"]);
  return p.assets.map((asset, index) => {
    const base = { index, label: asset.label, value: Math.max(0, asset.value), kind: asset.kind };
    const target = asset.allocatedTo ?? null;
    if (target === null || target === "") {
      return { ...base, target: null, allocated: 0, unused: base.value, note: asset.kind === "RETIREMENT" ? "RETIREMENT_DEFAULT" : "NOT_USED" } as AssetAllocation;
    }
    if (!isNeedKey(target, keys)) {
      return { ...base, target: null, allocated: 0, unused: base.value, note: "NOT_USED" } as AssetAllocation;
    }
    const left = remaining.get(target);
    if (left === undefined || left <= 0) {
      return { ...base, target, allocated: 0, unused: base.value, note: "NO_SUCH_NEED" } as AssetAllocation;
    }
    const allocated = Math.min(base.value, left);
    remaining.set(target, left - allocated);
    return { ...base, target, allocated, unused: base.value - allocated, note: allocated < base.value ? "TRIMMED" : "USED" } as AssetAllocation;
  });
}

export function reconcile(p: Profile, needs: NeedsResult, c: EngineConfig): Reconciliation {
  const src = { configVersion: c.configVersion };
  const flags: Flag[] = [];
  const own = p.existingCover.filter((x) => x.kind === "OWN");
  const emp = p.existingCover.filter((x) => x.kind === "EMPLOYER");
  const ownTotal = own.reduce((s, x) => s + x.deathSumAssured, 0);
  const empTotal = emp.reduce((s, x) => s + x.deathSumAssured, 0);
  const allocations = allocateAssets(p, needs);
  const assetTotal = allocations.reduce((s, x) => s + x.allocated, 0);

  for (const a of allocations) {
    if (a.note === "TRIMMED") {
      flags.push({ id: "ALLOCATION_TRIMMED", severity: "info", traceId: "FR-2.5", message: step(`${a.label}: only {used} of {value} is needed for ${a.target ? NEED_TARGET_LABELS[a.target] : "this need"}; the rest stays unused.`, { used: q(a.allocated, "inr"), value: q(a.value, "inr") }) });
    }
    if (a.note === "NO_SUCH_NEED") {
      flags.push({ id: "ALLOCATION_BLOCKED", severity: "info", traceId: "FR-2.5", message: step(`${a.label} is set aside for ${a.target ? NEED_TARGET_LABELS[a.target] : "a need"}, but nothing is left to fund there, so it isn't counted.`) });
    }
  }

  const offsets: OffsetSegment[] = [];
  if (ownTotal > 0) {
    offsets.push({
      key: "OWN",
      label: "Your policies",
      amount: ownTotal,
      explain: makeExplain({
        id: "offset.own",
        title: "Your own policies",
        result: q(ownTotal, "inrExact"),
        summary: step("We use the amount paid on death, not maturity value or premiums."),
        steps: own.map((x) => step(`${x.label}: paid on death {amt}`, { amt: q(x.deathSumAssured, "inrExact") })),
        inputs: own.map((x) => input(`${x.label}, paid on death`, q(x.deathSumAssured, "inrExact"), "you", "Stage 2")),
        traceIds: ["FR-2.4", "TC-13"],
        source: src,
      }),
    });
  }
  if (empTotal > 0) {
    offsets.push({
      key: "EMPLOYER",
      label: "Employer cover",
      amount: empTotal,
      explain: makeExplain({
        id: "offset.employer",
        title: "Employer cover",
        result: q(empTotal, "inrExact"),
        summary: step("Group cover from your job. It usually ends when you leave, so we show it on its own line."),
        steps: emp.map((x) => step(`${x.label}: paid on death {amt}`, { amt: q(x.deathSumAssured, "inrExact") })),
        inputs: emp.map((x) => input(`${x.label}, paid on death`, q(x.deathSumAssured, "inrExact"), "you", "Stage 2")),
        traceIds: ["FR-2.4", "TC-04"],
        source: src,
      }),
    });
  }
  if (assetTotal > 0) {
    const used = allocations.filter((a) => a.allocated > 0);
    offsets.push({
      key: "ASSETS",
      label: "Savings set aside",
      amount: assetTotal,
      explain: makeExplain({
        id: "offset.assets",
        title: "Savings set aside",
        result: q(assetTotal, "inrExact"),
        summary: step("Each savings pot is used once, for one need, and never above its value."),
        steps: used.map((a) => step(`${a.label} → ${a.target ? NEED_TARGET_LABELS[a.target] : ""}: {amt}`, { amt: q(a.allocated, "inrExact") })),
        inputs: allocations.map((a) => input(`${a.label}${a.target ? ` → ${NEED_TARGET_LABELS[a.target]}` : " (not used)"}`, q(a.value, "inrExact"), "you", "Stage 2")),
        traceIds: ["FR-2.5", "TC-14"],
        source: src,
      }),
    });
  }

  const totalOffsets = offsets.reduce((s, x) => s + x.amount, 0);
  const gross = needs.gross;
  const gap = gross - totalOffsets;
  const checkResidual = needs.components.reduce((s, x) => s + x.amount, 0) - totalOffsets - gap;

  const explain = makeExplain({
    id: "gap",
    title: gap > 0 ? "Your gap" : "You appear adequately covered",
    result: q(gap, "inrExact"),
    summary: gap > 0 ? step("What your family needs, minus the cover and savings already in place.") : step("The cover and savings you already have are at least what your family needs."),
    steps: [
      step(["{gross}", ...offsets.map((o) => `− {${o.key}}`), "= {gap}"].join(" "), {
        gross: q(gross, "inrExact"),
        ...Object.fromEntries(offsets.map((o) => [o.key, q(o.amount, "inrExact")])),
        gap: q(gap, "inrExact"),
      }),
    ],
    inputs: [input("What your family needs", q(gross, "inrExact"), "derived"), ...offsets.map((o) => input(o.label, q(o.amount, "inrExact"), "derived"))],
    traceIds: ["FR-2.8", "FR-2.10"],
    source: src,
  });

  return { gross, offsets, totalOffsets, gap, state: gap > 0 ? "GAP" : "COVERED", allocations, checkResidual, explain, flags };
}
