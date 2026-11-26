"use client";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import personasJson from "@/config/content/personas.json";
import { DEFAULT_ASSUMPTIONS, ENGINE_CONFIG } from "@/config";
import { CATALOG } from "@/data/catalog";
import { analyse, evaluateRules, inr, inrRange, pct, quickEstimate, type Profile } from "@/engine";
import { Button } from "@/components/ui/button";
import { useJourney } from "@/lib/journey-store";

const ORDER = ["suresh", "neha", "farhan", "invalid", "meena", "kavya", "gopal", "arjun", "ravi"];

/** Live result for each persona, computed by the same engine the journey uses. */
function live(p: (typeof personasJson.personas)[number]): { lines: string[]; fired: string[]; ok: boolean } {
  const qe = quickEstimate({ age: p.stage1.age, income: p.stage1.income, hasDependants: p.stage1.hasDependants }, ENGINE_CONFIG);
  if (!qe.ok) return { lines: qe.errors.map((e) => `${e.code}: ${e.message}`), fired: ["TC-12"], ok: true };
  const an = analyse(p.profile as Profile, DEFAULT_ASSUMPTIONS, ENGINE_CONFIG);
  if (!an.ok) return { lines: an.errors.map((e) => e.message), fired: ["TC-12"], ok: true };
  const r = evaluateRules(an.value, p.profile as Profile, DEFAULT_ASSUMPTIONS, ENGINE_CONFIG, CATALOG);
  const a = an.value;
  const lines = [`Stage 1 range ${inrRange(qe.value.low, qe.value.high)}`, a.recon.gap > 0 ? `Gap ${inr(a.recon.gap)} · insurer limit ${inr(a.cap.amount)}` : `Surplus ${inr(-a.recon.gap)}: adequately covered`];
  if (r.quote && r.selection) lines.push(`${CATALOG.products.find((x) => x.id === r.selection!.productId)?.name}: ${inr(r.selection.cover)} · ${r.selection.term} yrs → ${inr(r.quote.annual)} a year (${r.shareOfIncome !== null ? pct(r.shareOfIncome) : "—"} vs ${pct(DEFAULT_ASSUMPTIONS.affordCap, 0)} budget)`);
  if (r.state === "NO_ELIGIBLE_TERM") lines.push(r.notShown.filter((n) => n.product.category === "TERM").map((n) => `${n.product.name}: ${n.reasons[0].message}`).join(" · "));
  if (a.income.volatile) lines.push(`Income used ${inr(a.income.income)} (lower of average and latest); volatility flagged`);
  if (p.existingPolicy) lines.push(`Holds ${p.existingPolicy.name}, year ${p.existingPolicy.policyYear} of ${p.existingPolicy.policyTerm}`);
  const fired = [...r.fired, ...Array.from(new Set(r.notShown.flatMap((n) => n.reasons.map((x) => x.code))))];
  if (a.income.volatile) fired.push("TC-06");
  return { lines, fired, ok: true };
}

export function StatesBoard() {
  const router = useRouter();
  const loadPersona = useJourney((s) => s.loadPersona);
  const personas = ORDER.map((id) => personasJson.personas.find((p) => p.id === id)!).filter(Boolean);
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {personas.map((p) => {
        const l = live(p);
        return (
          <article key={p.id} className="card flex flex-col p-5" data-state={p.state}>
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-ink px-3 py-1 font-mono text-[12px] text-white">{"trace" in p && p.trace ? `${p.state} · ${p.trace}` : p.state}</span>
              <span className="text-[12px] text-muted-2">Live from the engine</span>
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold">{p.stateLabel}</h2>
            <p className="text-[14px] text-muted">
              {p.name}, {p.tagline}
            </p>
            <ul className="mt-3 flex-1 space-y-1.5 text-[13px] leading-5">
              {l.lines.map((x) => (
                <li key={x} className="num">
                  • {x}
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[12px] text-muted-2">Fired: {l.fired.join(", ") || "—"}</p>
            <Button
              className="mt-4 self-start"
              size="sm"
              onClick={() => {
                loadPersona(p.id);
                if (p.id === "invalid") useJourney.getState().setStage1({ age: String(p.stage1.age), incomeLakh: String(p.stage1.income / 100_000) });
                router.push(p.route.includes("?") ? `${p.route}&judge=1` : `${p.route}?judge=1`);
              }}
            >
              Open this scenario <ArrowRight className="size-4" aria-hidden />
            </Button>
          </article>
        );
      })}
    </div>
  );
}
