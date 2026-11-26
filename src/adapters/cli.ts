/**
 * npm run import:products|rates|profiles|advisors [-- --file <path>] [--dry]
 *
 * Reads CSV, JSON or XLSX from src/data/raw/ using src/adapters/mapping.<entity>.json,
 * validates with zod, prints a validation report (also saved next to the mapping),
 * and writes src/data/canonical/<file>.json unless --dry or the report has errors.
 */
import fs from "node:fs";
import path from "node:path";
import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { adapt, formatReport, type Entity, type Mapping, type Row } from "./core";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "src/data/raw");
const CANON = path.join(ROOT, "src/data/canonical");
const OUT_FILE: Record<Entity, string> = { products: "products.json", rates: "rate-tables.json", profiles: "profiles.json", advisors: "advisors.json" };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function readRows(file: string, sheet?: string): Promise<Row[]> {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".csv") return parseCsv(fs.readFileSync(file, "utf8"), { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Row[];
  if (ext === ".json") {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(j) ? j : (Object.values(j).find(Array.isArray) as Row[]) ?? [];
  }
  if (ext === ".xlsx") {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = sheet ? wb.getWorksheet(sheet) : wb.worksheets[0];
    if (!ws) throw new Error(`sheet ${sheet} not found`);
    const header: string[] = [];
    const rows: Row[] = [];
    ws.eachRow((r, i) => {
      const vals = (r.values as unknown[]).slice(1).map((v) => (v && typeof v === "object" && "result" in (v as object) ? (v as { result: unknown }).result : v));
      if (i === 1) vals.forEach((v) => header.push(String(v ?? "").trim()));
      else rows.push(Object.fromEntries(header.map((h, k) => [h, vals[k] ?? ""])));
    });
    return rows;
  }
  throw new Error(`Unsupported file type ${ext} (use .csv, .json or .xlsx)`);
}

async function main() {
  const entity = process.argv[2] as Entity;
  if (!["products", "rates", "profiles", "advisors"].includes(entity)) throw new Error("usage: cli.ts products|rates|profiles|advisors [--file f] [--dry]");
  const mapping = JSON.parse(fs.readFileSync(path.join(ROOT, `src/adapters/mapping.${entity}.json`), "utf8")) as Mapping;
  const file = arg("--file") ?? path.join(RAW, mapping.source?.file ?? `${entity}.csv`);
  if (!fs.existsSync(file)) throw new Error(`No input file at ${path.relative(ROOT, file)}. Put the reveal-day file in src/data/raw/ or pass --file.`);
  const rows = await readRows(file, mapping.source?.sheet);
  const { output, report } = adapt(rows, mapping);
  console.log(formatReport(report));
  fs.writeFileSync(path.join(ROOT, `src/adapters/report.${entity}.json`), JSON.stringify(report, null, 2) + "\n");

  if (process.argv.includes("--dry")) return console.log("  --dry: nothing written.");
  if (!report.ok && !process.argv.includes("--force")) {
    process.exitCode = 1;
    return console.log("  Not written: fix the issues above (or pass --force to write the valid rows only).");
  }
  const target = path.join(CANON, OUT_FILE[entity]);
  const prev = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, "utf8")) : {};
  const meta = { version: `reveal-${new Date().toISOString().slice(0, 10)}`, isSample: false, note: `Imported from ${path.basename(file)} by src/adapters/cli.ts` };
  const body =
    entity === "products"
      ? { ...meta, products: output }
      : entity === "rates"
        ? { ...meta, tables: output }
        : entity === "profiles"
          ? { source: "provided", label: "Provided data", profiles: output }
          : { ...meta, advisors: output, slotPatterns: prev.slotPatterns ?? {} };
  fs.writeFileSync(target, JSON.stringify(body, null, 1) + "\n");
  console.log(`  wrote ${path.relative(ROOT, target)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
