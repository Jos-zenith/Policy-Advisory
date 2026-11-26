# Famsurance

**PROTECT WHAT MATTERS**

An app that helps an everyday customer work out how much life cover their family actually needs, see which policy type fits that need, explore premium and tenure trade-offs, and book a qualified advisor, with every number traceable.

> Every other flow asks *"what do you want to buy?"*. Famsurance asks *"can your family carry on without you?"* first.

Built for the problem *Intelligent Life Insurance Needs Finder & Digital Advisory Platform*. This is an MVP running on **clearly labelled sample data** until the provided products, profiles and advisors are released. It is an educational calculator and appointment scheduler, **not financial advice**.

---

## The problem

Families are underinsured because nobody quantifies what protection they actually need. People choose a sum assured by affordability, tax saving or an agent's suggestion, not by income replacement, loans, dependants and goals. Famsurance closes that **assessment gap** first. Everything else in the product exists to stop a correct gap finding from going wrong afterwards:

| Problem | Role | How Famsurance responds |
|---|---|---|
| Nobody shows the gap | **The wedge** | Three-input verdict, then a reconciled gap where every number opens its formula |
| Savings plans bought as protection | Supporting | Protection-first rules: term first; savings plans stay locked while the gap is open |
| Surrender and lock-in surprises | Supporting | Year-by-year surrender table on every non-term product, labelled illustrative |
| Advice restarts from zero | Supporting | One-page handoff pack for the advisor, with an append-only decision trail |
| People leave before seeing value | Enabling | Verdict first; every later step is optional |

The evidence base and its sources are in PRD §2.2. Those figures are to be verified and date-stamped before any external use, so they are not repeated here.

## Goals

| Goal | Meaning | Priority |
|---|---|---|
| **G1 Adequacy first** | Every user sees a transparent protection gap before any price | Primary |
| **G2 Traceability** | Anyone can answer "why ₹X and not ₹Y?" without calling an agent | Primary |
| G3 Right product for the problem | Protection-first rules; savings products never solve a protection gap | Supporting |
| G4 Comprehension over consent | Users show they understand cover, surrender and the protection/savings split before booking | Supporting |
| G5 Warm handoff | The advisor gets the needs, assumptions, choice and comprehension result | Supporting |

**North-star metric:** households that see a quantified, explained protection gap (a verdict plus a reconciliation they can open).

## The journey: a skippable ladder

Every rung after the first is optional, and the user can stop with a useful answer on any rung. Contact details are asked for only on rung 4.

| Rung | Route | The user gets | It asks for |
|---|---|---|---|
| 1 · Verdict | `/estimate` | "Likely underinsured" or "Needs more detail", with an indicative range, in under 30 seconds | Age, annual income, dependants |
| 2 · Refined gap | `/gap` | Needs-based and income-based estimates side by side, a waterfall that adds up to the gap, "why ₹X and not ₹1 Cr?" | Loans, family costs, goals, existing cover, savings (each optional) |
| 3 · Options | `/options` | Term first with live cover, term and premium; savings plans locked with unlock conditions; existing-policy review | Preferences |
| 4 · Advisor | `/options?book=1` | Reality check, advisor and slot, consent, booking | Name, mobile, consent |

The result is labelled **Basic**, **Refined** or **Detailed**, and lists what was skipped and which way that could move the gap. Alongside the journey there is an advisor and compliance workspace (`/advisor`) and a judges' area (`/judges`, `/judges/states`, `/judges/qa`).

## What is built

| Area | PRD | Status |
|---|---|---|
| Stage 1 quick estimate | FR-1.1 – 1.3 | **Built.** Range plus verdict, live as you type, anonymous session. Stage 1 says "your gap depends on cover you already have" rather than showing a headline gap. |
| Needs, HLV and reconciliation | FR-2.1 – 2.10 | **Built.** Separate own and employer cover lines, death cover only, once-only asset allocation, need vs insurer cap, needs vs HLV flag, clickable waterfall, editable assumptions with reset. |
| Sensitivity ("why ₹X and not ₹Y?") | FR-2.11 | **Built** (promoted to P0). The ₹1 Cr runway plus a one-change-at-a-time table. |
| Product fit and sliders | FR-3.1 – 3.8 | **Built.** Protection-first waterfall, eligibility with the nearest eligible product, cover/term/frequency/rider sliders, share of income vs budget, affordability ladder, locked savings cards. |
| Surrender transparency | FR-4.1 – 4.4 | **Built, illustrative.** Higher of guaranteed and special value; ULIPs show lock-in only; term cards state low surrender risk. |
| Reality check | FR-5.1 – 5.2 | **Built.** Three questions; a wrong answer gets a correction and one retry; never blocks; the result goes to the advisor. |
| Existing-policy bridge | FR-6.1 | **Built**, with all four options (keep and add term, stop, paid-up, keep as is). |
| Advisor scheduler and handoff | FR-7.1 – 7.4, 7.6 | **Built.** Language and speciality filters, atomic booking, consent at booking, one-page handoff, "after the call" feedback. |
| Reschedule and cancel | FR-7.5 | **Not built yet.** |
| Governance | FR-8.1 – 8.4 | **Built.** Versioned config, append-only decision trail with JSON/CSV export, disclaimer on every page, 200-profile QA run with an in-app summary. |
| Save, resume and PDF | FR-8.5 | **Partly built.** Answers survive reloads within the browser tab; the print-friendly summary saves to PDF from the browser. There is no cross-device resume. |
| Vernacular UI; nudges, LLM explainer | FR-8.6, 8.7 | **Designed only.** All copy lives in `src/config/content/*.json`, ready for translation. |
| Plain language and progressive disclosure | FR-9.1 – 9.8 | **Built.** Result first, jargon in tooltips, "Show how this is calculated", visible progress, skippable sections. |

## How the numbers work (PRD §5.10)

```
Real rate        r = (1 + d) ÷ (1 + g) − 1          needs use (1 + d) ÷ (1 + i) − 1
Annuity factor   AF = (1 − (1 + r)^−n) ÷ r          AF = n when r ≈ 0
Annuity due      AF_due = AF × (1 + r)

HLV  = I × (1 − e) × AF_ordinary                    n = years to retirement
Need = loans + family costs × AF_due(i, years) + education + marriage
       + health and emergency + spouse retirement
Gap  = Need − own death cover − employer cover − savings allocated to needs
```

- **Guards:** a real rate of −100% or below is rejected; a negative real rate shows a warning and caps the horizon; no working years left gives an HLV of 0; zero income and homemakers are handled without errors.
- **Irregular income:** the lower of the 3-year average and the latest year, with a volatility flag.
- **Retirement savings** are left out unless the user explicitly allocates them.
- **Precision:** calculations run at full precision; rounding happens only for display.
- **Traceability:** every result records the config version (`v2026.11-s1`), and every headline number opens its formula, inputs and assumption IDs.

**Defaults are placeholders for a finance or actuarial reviewer, not industry standards:** inflation 6%, discount rate 7%, income growth 5%, retirement age 60, own spending 25%, 20 years of family support, a 6% budget limit, and age-banded income multiples and insurer caps. All of them live in `src/config/` and the user can adjust them in "Adjust assumptions".

**Reference persona, Arjun** (34, ₹18 L income, home loan, two children):

| | |
|---|---|
| First estimate | ₹2.7 Cr to ₹3.6 Cr, likely underinsured |
| Gross need | ₹2.97 Cr |
| Already in place | ₹58 L |
| Gap | **₹2.39 Cr** |
| Income-based estimate | ₹2.75 Cr |
| Insurer limit | ₹4.5 Cr |
| Term premium | ₹2.4 Cr for 25 years: **₹25,920 a year (1.4% of income)**, from an exact rate-table cell |

## Proof it holds (PRD §5.12)

- **Golden tests:** TC-01 to TC-15 and the Arjun fixture, with fixed inputs and a fixed config snapshot.
- **Property tests (fast-check):**
  - The reconciliation always adds up.
  - More cover never raises the gap.
  - More debt never lowers the need.
  - Ineligible products are never recommended.
  - Sliders never change the base inputs.
  - Results are deterministic.
  - An allocation never exceeds the asset's value.
  - No savings plan is recommended while the gap is open.
  - A higher discount rate never raises HLV (see open questions).
  - Premium never falls as cover rises.
- **Atomic booking:** two processes booking one slot produce exactly one booking. A repeated submit with the same idempotency key returns the original booking.
- **200-profile QA run:** every profile goes through the whole pipeline. On generated profiles: 200/200 handled, 0 unhandled, 0 reconciliation failures, 0 protection-first violations.
- **End to end (Playwright):** the Arjun journey from landing to the advisor's trail, the booking race, licence hiding, Judge mode, and no horizontal scroll at 390 px and 360 px.

`/judges/qa` renders these results from the files the test scripts write; nothing on it is typed by hand.

## Privacy, consent and audit

- **No personal data before booking.** Stages 1 to 3 use an anonymous session ID and keep answers in the browser. The journey's decision events reach the server only when the customer books and consents.
- **Separate consents** for preparing the summary, sharing it with the named advisor, and being contacted. Each records the consent text version and a timestamp.
- **Encryption at rest:** customer details, the handoff snapshot and trail details are encrypted with AES-256-GCM. No financial values are written to logs.
- **Append-only decision trail:** the database rejects edits and deletions. Every row carries a rule ID and the config version.
- **Advisor access:**
  - Only licensed, in-date advisors are shown.
  - Each advisor sees only their own bookings, until 7 days after the call.
  - Every view of a handoff pack is logged.
  - The workspace uses a **demo sign-in, not real authentication**.
- **Not built yet:**
  - Data rights: view, correct, export and delete (§6.1 row 8).
  - Rate limiting.
  - The final remuneration-disclosure wording, which is a placeholder for compliance.

## Quick start

Requires Node 20 or later (tested on Node 22).

```bash
npm ci
cp .env.example .env      # set DATA_KEY to any random string of 32+ characters
npm run seed              # creates ./data/app.db with sample advisors and 10 working days of slots
npm run dev               # http://localhost:3000
```

Open `/judges` for the guide, or `/?judge=1` to see requirement and rule IDs on every screen.

## The 60-second demo

1. **`/` → "Check my family's gap" → tap "Arjun".** A verdict and range appear straight away: likely underinsured, ₹2.7 Cr to ₹3.6 Cr. No name, phone or email is asked for.
2. **"Refine my gap".** The gap is **₹2.39 Cr** and the waterfall adds up to it. Tap *Living costs* to see the real rate, the annuity factor, the inputs and the config version.
3. **"Why ₹2.39 Cr and not ₹1 Cr?"** On its own, ₹1 Cr runs out after the home loan and about 7½ years of living costs.
4. **"See what fits this gap".** Term cover first, at ₹25,920 a year. Drag the cover slider below the gap and the coverage meter reopens it. Savings plans stay locked, each with an unlock condition.
5. **"I already have a policy".** Stopping Arjun's endowment now would lose ₹96,000. The four options sit side by side, and the suggestion is to keep it and add term cover.
6. **"Book a free advisor call".**
   - Answer the reality check (a wrong answer gets an explanation and a retry).
   - Pick a slot, enter a name and mobile number, and give the three consents.
   - Confirm the booking.
7. **`/advisor`.** Sign in as the booked advisor, open the **handoff**, then the **decision trail**.

Finish on `/judges/states` (every decision state, computed live) and `/judges/qa` (the evidence).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Development server / production build (`output: "standalone"`) / start |
| `npm run seed` | Creates the schema, sample advisors and the next 10 working days of slots. Safe to re-run; `SEED_RESET=1` starts fresh |
| `npm test` | Unit, golden, property and server tests (Vitest) |
| `npm run test:report` | The same tests, writing `src/qa/test-results.json` for `/judges/qa` |
| `npm run test:e2e` | Playwright against a fresh e2e database. Run `npm run build` first, or set `E2E_BASE_URL` to test a running server |
| `npm run qa` | Runs every profile through the full pipeline and writes `src/qa/qa-results.json` |
| `npm run typecheck` / `lint` / `ci` | Strict TypeScript, ESLint, and all checks together |
| `npm run import:products\|rates\|profiles\|advisors` | Reveal-day data import (below) |

## Reveal day: swapping in the provided data

The 14 products and rate tables, 200 profiles and 15 advisors replace the sample files through adapters. The calculation engine, rules and UI don't change.

1. Put the provided files (CSV, JSON or XLSX) in `src/data/raw/`.
2. In `src/adapters/mapping.<entity>.json`, change the source column names on the left to match the files. Add value maps, for example `"Male" → "M"`.
3. Dry-run each import and read the validation report. It lists unmapped columns and values, missing fields, out-of-range values, premiums that fall as cover rises, and rate tables whose dimensions don't match. For example: `npm run import:rates -- --dry`.
4. Run without `--dry` to write `src/data/canonical/`. The import refuses to write while the report has errors.
5. Import advisors, then `SEED_RESET=1 npm run seed`. Import profiles, then `npm run qa`. The QA page switches its label from "generated" to "provided data".
6. Run `npm run test:report` and check `/judges/qa`. The target is every profile handled, 0 unhandled.

If the provided tables include surrender values, add them as a schedule in `src/config/surrender.json` and drop the "Illustrative" label for those products.

## How it is built

| Layer | Where | Notes |
|---|---|---|
| Calculation and rule engine | `src/engine/` | Pure TypeScript with no UI, network or file access. Every function returns its values plus an explanation. Rounding happens only in `format.ts`. |
| Versioned config and copy | `src/config/` | Assumptions, income bands, caps, surrender schedules, rule parameters, and all customer-facing text. |
| Canonical data | `src/data/` | Sample products, generated rate tables, advisors and slots, validated with zod. |
| Server | `src/server/`, `src/app/api/` | SQLite (better-sqlite3); atomic booking in one transaction; encrypted columns; the advisor's snapshot is rebuilt on the server with the same engine. |
| UI | `src/app/`, `src/components/` | Next.js 16 App Router, Tailwind CSS, Radix UI. Layouts work from 1440 px down to 360 px. |
| Adapters and QA | `src/adapters/`, `src/qa/` | Reveal-day import, plus the seeded 200-profile QA run. |

**Deploy:** `docker build -t famsurance .` then `docker run -p 3000:3000 -e DATA_KEY=… -v famsurance-data:/data famsurance`. The container seeds its own volume when it starts. `render.yaml` defines the same service on Render with a persistent disk at `/data`.

## Who it is for: business model hypothesis

**B2B2C.** A financial institution licenses Famsurance and offers it to its own customers. That could be an insurer, a bank or NBFC at loan origination, or an employer benefits programme. The institution is the buyer; the customer and the advisor are the users.

Famsurance doesn't earn commission on policies sold, because that would reward conversion over adequacy. Nothing about billing, multi-tenancy or white-labelling is built. Branding, rules and rate tables stay in configuration, so a second institution could be added without code changes.

## Open questions and known limitations

- **Sample data:**
  - Products, rate tables (formula-generated), advisors and licence numbers are fictional.
  - The QA profiles are generated (seed 20261126).
  - Surrender, paid-up and maturity values are illustrative, and the special surrender value is a placeholder schedule.
- **Placeholder assumptions:** every default assumption, income multiple, insurer cap and the 6% budget limit needs a finance or actuarial reviewer's sign-off.
- **HLV at a zero real rate:** the horizon cap applies only when the real rate is negative, as specified. As a result, HLV jumps when the real rate crosses zero for someone with more than 40 working years. A reviewer should decide whether the cap should always apply.
- **Pre-tax or post-tax income:** still undecided (PRD §5.10, open item).
- **Missing verdict:** the Stage 1 verdict has "Likely underinsured" and "Needs more detail"; the PRD's "possibly adequate" verdict is not modelled yet.
- **Regulatory points to confirm** with legal and compliance before any live use:
  - whether rule-based category mapping counts as advice or solicitation;
  - remuneration-disclosure wording;
  - alignment with the DPDP Act 2023.
- **Out of scope** (PRD §7.2): purchase, payment, KYC, underwriting, claims, servicing, real insurer or advisor integrations, ML models, and native apps.
