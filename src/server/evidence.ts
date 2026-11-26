/**
 * Reads generated evidence for /judges/qa. Nothing here is hand-typed:
 * src/qa/test-results.json  ← npm run test:report (Vitest JSON reporter)
 * src/qa/qa-results.json    ← npm run qa
 * src/qa/e2e-results.json   ← npm run test:e2e (Playwright JSON reporter)
 * Missing files are reported as "not run yet".
 */
import fs from "node:fs";
import path from "node:path";

const dir = () => path.join(process.cwd(), "src/qa");

function readJson<T>(name: string): { data: T; mtime: string } | null {
  const f = path.join(dir(), name);
  if (!fs.existsSync(f)) return null;
  try {
    return { data: JSON.parse(fs.readFileSync(f, "utf8")) as T, mtime: fs.statSync(f).mtime.toISOString() };
  } catch {
    return null;
  }
}

export interface UnitTest {
  file: string;
  group: "golden" | "property" | "unit" | "server" | "other";
  name: string;
  status: string;
}

export interface TestEvidence {
  at: string;
  total: number;
  passed: number;
  failed: number;
  tests: UnitTest[];
}

type VitestJson = {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  startTime?: number;
  testResults: { name: string; assertionResults: { ancestorTitles: string[]; title: string; status: string; fullName: string }[] }[];
};

export function testEvidence(): TestEvidence | null {
  const r = readJson<VitestJson>("test-results.json");
  if (!r) return null;
  const tests: UnitTest[] = [];
  for (const f of r.data.testResults) {
    const rel = f.name.replace(/\\/g, "/").replace(/^.*?\/tests\//, "tests/");
    const group = rel.includes("/golden/") ? "golden" : rel.includes("/property/") ? "property" : rel.includes("/unit/") ? "unit" : rel.includes("/server/") ? "server" : "other";
    for (const a of f.assertionResults) tests.push({ file: rel, group, name: [...a.ancestorTitles, a.title].join(" › "), status: a.status });
  }
  return { at: r.data.startTime ? new Date(r.data.startTime).toISOString() : r.mtime, total: r.data.numTotalTests, passed: r.data.numPassedTests, failed: r.data.numFailedTests, tests };
}

export interface QaEvidence {
  generatedAt: string;
  configVersion: string;
  dataSource: string;
  dataLabel: string;
  seed: number | null;
  n: number;
  valid: number;
  invalid: number;
  handled: number;
  unhandled: number;
  unhandledCases: { id: string; reason: string }[];
  byState: Record<string, number>;
  byRecommendation: Record<string, number>;
  fallbacks: Record<string, number>;
  invalidCodes: Record<string, number>;
  checks: Record<string, number>;
  durationMs: number;
}

export function qaEvidence(): QaEvidence | null {
  return readJson<QaEvidence>("qa-results.json")?.data ?? null;
}

type PwSuite = { title: string; specs?: { title: string; ok: boolean; tests: { results: { status: string; duration: number }[] }[] }[]; suites?: PwSuite[] };

export function e2eEvidence(): { at: string; specs: { title: string; ok: boolean }[] } | null {
  const r = readJson<{ suites: PwSuite[]; stats?: { startTime?: string } }>("e2e-results.json");
  if (!r) return null;
  const specs: { title: string; ok: boolean }[] = [];
  const walk = (s: PwSuite, prefix: string) => {
    for (const sp of s.specs ?? []) specs.push({ title: prefix ? `${prefix} › ${sp.title}` : sp.title, ok: sp.ok });
    for (const c of s.suites ?? []) walk(c, c.title.endsWith(".ts") ? "" : prefix ? `${prefix} › ${c.title}` : c.title);
  };
  for (const s of r.data.suites) walk(s, "");
  return { at: r.data.stats?.startTime ?? r.mtime, specs };
}
