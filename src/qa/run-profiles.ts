/**
 * npm run qa — run every profile through the full pipeline and write
 * src/qa/qa-results.json (read by /judges/qa).
 *
 *   quick estimate → needs → reconciliation → rules → price the recommended
 *   product at the recommended cover and term.
 *
 * Source: src/data/canonical/profiles.json. If it is missing (or --generate is
 * passed) a seeded set of 200 profiles is generated and labelled as such.
 * Target: N/N valid-or-rejected-with-reason, 0 unhandled.
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_ASSUMPTIONS, ENGINE_CONFIG } from "@/config";
import { CATALOG } from "@/data/catalog";
import { analyse, evaluateRules, quickEstimate, type Profile } from "@/engine";
import { generateProfiles } from "./generate-profiles";

const PROFILES = path.join(process.cwd(), "src/data/canonical/profiles.json");
const OUT = path.join(process.cwd(), "src/qa/qa-results.json");

type ProfileFile = { source: "generated" | "provided"; label: string; seed?: number; profiles: Profile[] };

function load(): ProfileFile {
  if (process.argv.includes("--generate") || !fs.existsSync(PROFILES)) {
    const seed = 20261126;
    const file: ProfileFile = { source: "generated", label: "Generated, not the provided data", seed, profiles: generateProfiles(200, seed) };
    fs.writeFileSync(PROFILES, JSON.stringify(file, null, 1) + "\n");
    return file;
  }
  return JSON.parse(fs.readFileSync(PROFILES, "utf8")) as ProfileFile;
}

function inc(m: Record<string, number>, k: string) {
  m[k] = (m[k] ?? 0) + 1;
}

function main() {
  const file = load();
  const A = DEFAULT_ASSUMPTIONS;
  const byState: Record<string, number> = {};
  const byRecommendation: Record<string, number> = {};
  const fallbacks: Record<string, number> = {};
  const invalidCodes: Record<string, number> = {};
  const unhandled: { id: string; reason: string }[] = [];
  let valid = 0;
  let invalid = 0;
  let reconFailures = 0;
  let p4Violations = 0;
  let exactCells = 0;
  let priced = 0;
  const started = Date.now();

  for (const p of file.profiles) {
    try {
      const income = p.incomeHistory[p.incomeHistory.length - 1] ?? 0;
      quickEstimate({ age: p.age, income, hasDependants: p.dependants.length > 0 }, ENGINE_CONFIG);
      const r = analyse(p, A, ENGINE_CONFIG);
      if (!r.ok) {
        invalid++;
        for (const e of r.errors) inc(invalidCodes, e.code);
        continue;
      }
      const an = r.value;
      const sum = an.needs.components.reduce((s, x) => s + x.amount, 0) - an.recon.offsets.reduce((s, x) => s + x.amount, 0);
      if (Math.abs(sum - an.recon.gap) > 1e-6 * Math.max(1, an.needs.gross)) reconFailures++;
      if (![an.needs.gross, an.recon.gap, an.hlv.value].every(Number.isFinite)) throw new Error("non-finite result");

      const out = evaluateRules(an, p, A, ENGINE_CONFIG, CATALOG);
      inc(byState, out.state);
      for (const f of out.fired) if (f !== "R1") inc(fallbacks, f);
      for (const n of out.notShown) for (const reason of n.reasons) inc(fallbacks, reason.code);
      if (an.recon.gap > 0 && out.cards.some((c) => c.product.category !== "TERM" && c.status === "RECOMMENDED")) p4Violations++;
      if (an.recon.gap > 0 && out.cards.some((c) => (c.product.category === "ENDOWMENT" || c.product.category === "ULIP") && c.status === "ADDON")) p4Violations++;

      if (out.state === "R1") {
        if (!out.recommendedId || !out.quote) throw new Error("R1 without a priced recommendation");
        priced++;
        if (out.quote.exact) exactCells++;
        inc(byRecommendation, CATALOG.products.find((x) => x.id === out.recommendedId)!.name);
      } else if (out.state === "NO_ELIGIBLE_TERM") {
        inc(byRecommendation, "Advisor (no eligible term product)");
      } else {
        inc(byRecommendation, "None (adequately covered)");
      }
      valid++;
    } catch (e) {
      unhandled.push({ id: p.id, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    configVersion: ENGINE_CONFIG.configVersion,
    catalogVersion: CATALOG.version,
    dataSource: file.source,
    dataLabel: file.label,
    seed: file.seed ?? null,
    n: file.profiles.length,
    valid,
    invalid,
    handled: valid + invalid,
    unhandled: unhandled.length,
    unhandledCases: unhandled,
    byState,
    byRecommendation,
    fallbacks,
    invalidCodes,
    checks: { reconciliationIdentityFailures: reconFailures, p4Violations, pricedRecommendations: priced, exactRateCells: exactCells },
    durationMs: Date.now() - started,
  };
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
  console.log(`[qa] ${file.source}: ${result.handled}/${result.n} handled (${valid} valid, ${invalid} rejected with a reason), ${result.unhandled} unhandled, ${reconFailures} identity failures, ${p4Violations} P4 violations → ${path.relative(process.cwd(), OUT)}`);
  if (result.unhandled || reconFailures || p4Violations) process.exitCode = 1;
}

main();
