# Decisions

One line of rationale each. Newest at the bottom. IDs are referenced from code comments.

| ID | Decision | Rationale |
|----|----------|-----------|
| D-01 | `docs/PRD.md` was not supplied; requirement IDs (FR-x, TC-x, R-x) are taken from CLAUDE.md and the wireframe copy. | The PRD is third in precedence and was missing; nothing blocks on it. Drop the PRD into `docs/` and re-check IDs. |
| D-02 | Wireframes moved from `./wireframes` to `docs/wireframes/`; the 4 MB `Needs Finder Wireframes.html` moved to `docs/`. | Matches the repo layout in CLAUDE.md §5. |
| D-03 | Work happens on branch `build/needs-finder`, not `main`. | Keeps `main` clean until you choose to merge. |
| D-04 | Vitest pinned to v4 and run from an uppercase drive path (`D:\…`) on Windows. | With a lowercase `d:\` cwd, vitest loads its runner twice and finds no suite; v5 behaves the same. CI on Linux is unaffected. |
| D-05 | Brand shown as "Needs Finder" instead of the wireframe's "INSURANCE". | The wireframe word is a placeholder; a generic insurer-like mark could read as a real company. |
| D-06 | The Stage 1 sentence "Many existing policies cover less than 5 times" is dropped. | It is an unsourced statistic (P7, §21 "never invent statistics"). Replaced with "Your gap depends on cover you already have; add it in step 2" (§12). |
| D-07 | Quick-estimate verdict: dependants and income > 0 → "Likely underinsured" (orange); otherwise "Needs more detail" (blue). | Stage 1 has no existing cover, so it cannot say "adequately covered"; the neutral state covers no-dependants and zero-income cases. |
| D-08 | `Profile` gains three optional fields: `isHomemaker`, `householdContributionPerYear`, `estateNeed`. | TC-05 (homemaker HLV) and R2 (estate need) need inputs the canonical schema does not carry. Optional, so reveal-day data still validates. |
| D-09 | `incomeHistory` is ordered oldest → latest; the last entry is "this year". | Needed for "lower of the 3-year average and the latest year". |
| D-10 | A homemaker's HLV uses the household-contribution value with no own-spending deduction. | The contribution is a replacement cost of services, not income the person consumes. |
| D-11 | Asset allocation is capped at what the target need still requires; the rest is reported as unused. | Prevents a savings pot offsetting more than the need it is set aside for; satisfies "never above its value". |
| D-12 | The insurer cap (FR-2.6, R6) is compared with the gap (new cover to buy), not gross needs. | Matches wireframe copy "Your gap fits within it." The need itself is never capped (P6). |
| D-13 | The "What ₹1 Cr would cover" runway applies ₹1 Cr on its own to gross needs (loan → living years → goals), with years rounded down to a half year. | Reproduces the wireframe's "Home loan ₹45 L, about 7½ years… last 12½ years" exactly. The UI labels it "on its own, before cover and savings you already have". For gaps under ₹1.2 Cr the comparison amount becomes half the gap, rounded down to ₹5 L. |
| D-14 | Sensitivity deltas live in config as ±5 years and ±1 percentage point. | Reproduces 15/25 years and 5%/7% for Arjun, and generalises to any base. |
| D-15 | Living-cost factors are shown with the fewest decimals (2–8) that make `amount × factor = result` consistent to the rupee. | CLAUDE.md §8 wireframe-rounding note; avoids the wireframe's ₹1,31,91,000. |
| D-16 | A-SSV is implemented as a placeholder special-surrender schedule (`SSV-PLACEHOLDER`, 15% in year 1 only); surrender value = max(GSV, SSV). | The prompt says "stated in config"; this reproduces the wireframe's year-1 15% and keeps later years on the guaranteed schedule. |
| D-17 | The A-MAX-HORIZON guard stays exactly as specified (cap n only while r_real < 0). The HLV monotonicity property is checked within one cap regime; the crossing case fast-check found is pinned as a golden test. | When working years exceed 40, HLV jumps at r = 0 (n 40 → 41). Capping n always would change HLV for 18–19-year-olds under default assumptions. A finance reviewer should choose; flagged in the Judge's Guide. |
