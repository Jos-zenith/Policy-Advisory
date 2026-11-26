# Progress

| Phase | Status | Notes |
|-------|--------|-------|
| 0 · Repo, tooling, deploy skeleton, theme, layout shell, format.ts | done | Next 16 (App Router), Tailwind 4, Radix, Zustand, zod, better-sqlite3, Vitest 4, fast-check, Playwright. Dockerfile + render.yaml + GitHub Actions CI. Live URL needs your Render/Railway account (not deployed from here). |
| 1 · Canonical schema, sample data, config, seeded DB | done | 6 sample products, 6 generated rate tables (2,915 cells; RT-TS-01 reference cell = ₹1.08), 6 advisors (one expired licence), 150 slots over 10 working days, 9 personas, zod schemas, append-only trail via SQLite triggers. `npm run seed` is idempotent. |
| 2 · Engine: quick estimate, needs, HLV, reconcile, cap, sensitivity, explain | done | Arjun fixture matches to the paisa (incl. sensitivity and ₹1 Cr runway). Golden TC-01, 03–07, 10–15 plus guards; 8 property tests. fast-check found an HLV jump at r = 0 when the horizon cap binds; pinned as a golden test (D-17). |
| 3 · Landing, Stage 1, Stage 2 | done | Landing with live mini-verdict (no statistics), Stage 1 with 300 ms debounce and validation, Stage 2 hero, needs vs income cards, waterfall + calc panel (bottom sheet on phones), details editors with V-COVER-01 and once-only allocation, assumptions drawer with per-change effect, runway + sensitivity, print summary page. Trail events buffered client-side. |
