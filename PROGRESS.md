# Progress

| Phase | Status | Notes |
|-------|--------|-------|
| 0 · Repo, tooling, deploy skeleton, theme, layout shell, format.ts | done | Next 16 (App Router), Tailwind 4, Radix, Zustand, zod, better-sqlite3, Vitest 4, fast-check, Playwright. Dockerfile + render.yaml + GitHub Actions CI. Live URL needs your Render/Railway account (not deployed from here). |
| 1 · Canonical schema, sample data, config, seeded DB | done | 6 sample products, 6 generated rate tables (2,915 cells; RT-TS-01 reference cell = ₹1.08), 6 advisors (one expired licence), 150 slots over 10 working days, 9 personas, zod schemas, append-only trail via SQLite triggers. `npm run seed` is idempotent. |
