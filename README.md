# Needs Finder

**Could your family carry on without you?** An intelligent life-insurance needs finder and digital advisory journey. Most flows ask "what do you want to buy?"; this one asks whether the family can carry on first, and only shows a price after that.

Four stages: **Verdict** (quick estimate) → **Refined gap** (needs approach + human life value, with a traceable reconciliation) → **Options** (rule-based product fit, live premium and term sliders, surrender transparency, existing-policy bridge) → **Advisor** (reality check, booking, handoff pack). Plus an advisor/compliance workspace and a judges' area.

> Selection-phase build. All products, rate tables, advisors, licences and profiles are **clearly labelled sample data**. Assumptions are **placeholders for a finance reviewer**. Surrender, paid-up and maturity values are **illustrative**. Educational calculator, not financial advice.

## Quick start

Requires Node 20+ (tested on Node 22).

```bash
npm ci
cp .env.example .env      # set DATA_KEY (any 32+ char random string)
npm run seed              # creates ./data/app.db with sample advisors and 10 working days of slots
npm run dev               # http://localhost:3000
```

Open `/judges` for the guide, or `/?judge=1` to start the journey with requirement IDs visible.

## The 60-second demo

1. **`/` → "Check my family's gap" → tap "Arjun".** A verdict and range appear straight away: *Likely underinsured · ₹2.7 Cr – ₹3.6 Cr*. No name, phone or email asked.
2. **"Refine my gap".** The hero shows **₹2.39 Cr**. The waterfall adds up to the gap (the check line says so). Tap *Living costs*: the panel shows the real rate, the annuity factor, inputs with assumption IDs and the config version, all rendered from the engine's `explain` data.
3. **Scroll to "Why ₹2.39 Cr and not ₹1 Cr?"** ₹1 Cr on its own runs out after the home loan and about 7½ years of living costs. The sensitivity table changes one assumption at a time.
4. **"See what fits this gap".** Term first: TermSecure Plus, ₹2.4 Cr for 25 years, **₹25,920 a year (1.4% of income)** from exact cell `RT-TS-01`. Drag the cover slider below the gap and the coverage meter reopens it. Whole life, endowment and ULIP are locked, each with an unlock condition. The endowment card shows what early exit costs.
5. **"I already have a policy"** shows Arjun's SureSave 16: stopping now loses ₹96,000, and the four options are side by side. The suggestion is to keep it and add term cover.
6. **"Book a free advisor call".** Answer the reality check (try a wrong answer: it explains and lets you retry), pick a slot, enter a name and mobile, tick the three consents, then confirm.
7. **"See the advisor's view"**: on `/advisor`, sign in as the booked advisor (demo sign-in) → **Handoff** → **Decision trail** (export JSON/CSV).

Then show `/judges/states` (every decision state, live) and `/judges/qa` (test and QA evidence, read from generated files).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build (`output: "standalone"`) / start |
| `npm run seed` | Create the schema, upsert sample advisors, add slots for the next 10 working days. Idempotent; `SEED_RESET=1` recreates the DB |
| `npm test` | Vitest: unit, golden, property (fast-check) and server tests |
| `npm run test:report` | Same, and writes `src/qa/test-results.json` for `/judges/qa` |
| `npm run test:e2e` | Playwright (run `npm run build` first; it seeds `data/e2e.db` and starts `next start`). Set `E2E_BASE_URL` to test a running server |
| `npm run qa` | Runs every profile through the full pipeline → `src/qa/qa-results.json`. Generates 200 seeded profiles if `src/data/canonical/profiles.json` is missing |
| `npm run typecheck` / `lint` / `ci` | Strict TypeScript, ESLint, and all of the above |
| `npm run gen:data` | Regenerate the sample rate tables |
| `npm run import:products\|rates\|profiles\|advisors` | Reveal-day adapters (below) |

**Windows note:** run Vitest from a path with an upper-case drive letter (e.g. `D:\…`). With a lower-case `d:\` working directory, Vitest loads its runner twice and reports "no test suite found" (DECISIONS D-04). CI on Linux is unaffected.

## Reveal day: swapping in the real data

Only the adapters change; the engine, rules and UI stay untouched.

1. Put the provided files in `src/data/raw/` (CSV, JSON or XLSX).
2. Edit the left-hand column names in `src/adapters/mapping.<entity>.json` to match the files (canonical paths on the right stay). Add value maps for codes such as `"Male" → "M"`.
3. Dry-run each import and read the validation report: unmapped columns and values, missing required fields, out-of-range values, non-monotonic premiums, and rate tables whose dims differ from the declared dims.
   ```bash
   npm run import:products -- --dry
   npm run import:rates -- --dry
   ```
4. Run without `--dry` to write `src/data/canonical/*.json` (refused while the report has errors, unless `--force`).
5. `npm run import:advisors && SEED_RESET=1 npm run seed`. Advisors without a slot pattern get a default day.
6. `npm run import:profiles && npm run qa`. The QA page then says "provided data" instead of "generated".
7. `npm run test:report`, then check `/judges/qa`. The target is N/N handled, 0 unhandled.

If the real tables include surrender values, add them as a schedule in `src/config/surrender.json`, point the product's `surrenderScheduleId` at it, and drop the "Illustrative" wording for those products. If not, the config schedule and the "Illustrative" label stay.

## How it is built

- **`src/engine/`**: pure TypeScript, no React, fetch or fs (enforced by ESLint). Every function takes `(inputs, assumptions, config)` and returns values plus an `explain` object (formula template, filled values, inputs, assumption IDs, config version). The UI renders explanations from that data (P2). Rounding happens only in `format.ts`.
- **`src/config/`**: versioned JSON (`v2026.11-s1`): assumptions, income bands, insurer caps, surrender schedules, rule parameters, and all customer copy in `content/*.json` (ready for vernacular UI).
- **`src/data/`**: canonical sample data and zod schemas. Rate tables load lazily on Stage 3.
- **`src/server/`**: SQLite via better-sqlite3. Booking runs in one `BEGIN IMMEDIATE` transaction with an `Idempotency-Key`. The trail is append-only (SQLite triggers reject UPDATE/DELETE). Customer details, handoff snapshots and trail detail are encrypted with AES-256-GCM. The snapshot is rebuilt on the server from the same engine.
- **Privacy (P5):** Stages 1–3 keep everything in the browser's sessionStorage under an anonymous session ID. Trail events are sent to the server only when the customer books and consents.

Key choices and their reasons are in [DECISIONS.md](DECISIONS.md); phase status is in [PROGRESS.md](PROGRESS.md).

## Deploy

- **Docker:** `docker build -t needs-finder . && docker run -p 3000:3000 -e DATA_KEY=… -v nf-data:/data needs-finder`. The container seeds its volume on start.
- **Render:** `render.yaml` defines a Docker web service with a 1 GB disk at `/data` and a generated `DATA_KEY`.

## Known limitations

- Sample products, rate tables (formula-generated), advisors and licence numbers are fictional. Profiles for the QA run are generated (seed 20261126).
- Assumption defaults, income multiples, insurer-cap multiples and the 6% budget limit are placeholders. The special surrender value (A-SSV) is a placeholder schedule.
- The advisor workspace uses a demo role cookie, **not real authentication**. Remuneration disclosure text is a placeholder for compliance.
- No purchase, payment, KYC, underwriting, claims or real insurer integration (out of scope).
