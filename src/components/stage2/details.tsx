"use client";
import * as Accordion from "@radix-ui/react-accordion";
import { useState, type ReactNode } from "react";
import { ChevronDown, Info, Plus, Trash2 } from "lucide-react";
import {
  acceptCoverEntry,
  COVER_PROMPT,
  GOAL_LABELS,
  GOAL_ORDER,
  inr,
  inrExact,
  NEED_TARGET_LABELS,
  renderStep,
  type Analysis,
  type Assumptions,
  type Category,
  type CoverAmountType,
  type GoalKind,
  type Profile,
  type Result,
} from "@/engine";
import { MoneyField, SelectField, TextField } from "@/components/ui/money-field";
import { Trace } from "@/components/ui/trace";
import { useJourney } from "@/lib/journey-store";
import { cn } from "@/lib/cn";

function Item({ value, title, summary, children, trace, skipped }: { value: string; title: string; summary: ReactNode; children: ReactNode; trace?: string; skipped?: boolean }) {
  return (
    <Accordion.Item value={value} className="border-b border-line last:border-b-0">
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-start justify-between gap-4 py-4 text-left">
          <span className="min-w-0">
            <span className="block font-semibold">
              {title}
              {skipped ? <span className="ml-1 font-normal text-muted-2">· skipped</span> : null} {trace ? <Trace id={trace} /> : null}
            </span>
            <span className="mt-0.5 block text-[14px] leading-5 text-muted">{summary}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-blue">
            <span className="group-data-[state=open]:hidden">{skipped ? "Add" : "Edit"}</span>
            <span className="hidden group-data-[state=open]:inline">Done</span>
            <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
          </span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="pb-5">{children}</Accordion.Content>
    </Accordion.Item>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:bg-bg-alt">
      <Plus className="size-4" aria-hidden /> {children}
    </button>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="mb-5 grid size-11 shrink-0 place-items-center rounded-xl border border-line text-muted hover:bg-bg-alt">
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "TERM", label: "Term plan" },
  { value: "ENDOWMENT", label: "Endowment / savings plan" },
  { value: "WHOLE_LIFE", label: "Whole life" },
  { value: "ULIP", label: "ULIP" },
];

export function YourDetails({ an, a, employerLost }: { an: Analysis | null; a: Assumptions; employerLost: Result<Analysis> | null }) {
  const profile = useJourney((s) => s.profile);
  const provided = useJourney((s) => s.provided);
  const update = useJourney((s) => s.updateProfile);
  const log = useJourney((s) => s.log);
  const employerLostView = useJourney((s) => s.employerLostView);
  const setEmployerLostView = useJourney((s) => s.setEmployerLostView);
  const [coverTypes, setCoverTypes] = useState<Record<number, CoverAmountType>>({});
  const [pendingCover, setPendingCover] = useState<Record<number, number | null>>({});

  const set = (fn: (p: Profile) => Profile, section: Parameters<typeof update>[1]) => update(fn, section);

  const loansSummary = profile.loans.length ? profile.loans.map((l) => `${l.label || "Loan"} ${inrExact(l.outstanding)}`).join(" · ") : "No loans entered";
  const goalsSummary = profile.goals.filter((g) => g.amount > 0).length ? profile.goals.filter((g) => g.amount > 0).map((g) => `${g.label || GOAL_LABELS[g.kind]} ${inr(g.amount)}`).join(" · ") : "No goals entered";
  const own = profile.existingCover.filter((c) => c.kind === "OWN");
  const emp = profile.existingCover.filter((c) => c.kind === "EMPLOYER");
  const needKeys = an ? an.needs.components.map((c) => c.key) : [];

  return (
    <section className="card p-6 md:p-7" aria-labelledby="your-details">
      <div className="flex items-baseline justify-between">
        <h2 id="your-details" className="font-display text-xl font-semibold">
          Your details
        </h2>
        <span className="text-sm text-muted-2">Every section is optional</span>
      </div>
      <Accordion.Root type="multiple" className="mt-2">
        <Item value="family" title="Family" summary={`${profile.dependants.length ? profile.dependants.map((d) => d.relation + (d.lifelong ? " (lifelong support)" : "")).join(" · ") : "No one depends on your income"}${profile.estateNeed ? " · wants to leave an estate" : ""}`}>
          <div className="space-y-3">
            {profile.dependants.map((d, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3">
                <TextField className="min-w-[160px] flex-1" label="Who" value={d.relation} onChange={(v) => set((p) => ({ ...p, dependants: p.dependants.map((x, j) => (j === i ? { ...x, relation: v } : x)) }), undefined)} />
                <label className="mb-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4" checked={!!d.lifelong} onChange={(e) => set((p) => ({ ...p, dependants: p.dependants.map((x, j) => (j === i ? { ...x, lifelong: e.target.checked } : x)) }), undefined)} />
                  Needs support for life
                </label>
                <RemoveButton label={`Remove ${d.relation}`} onClick={() => set((p) => ({ ...p, dependants: p.dependants.filter((_, j) => j !== i) }), undefined)} />
              </div>
            ))}
            <AddButton onClick={() => set((p) => ({ ...p, dependants: [...p.dependants, { relation: "Child" }] }), undefined)}>Add someone</AddButton>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" checked={!!profile.estateNeed} onChange={(e) => set((p) => ({ ...p, estateNeed: e.target.checked }), undefined)} />I would like to leave an estate
            </label>
          </div>
        </Item>

        <Item value="loans" title="Loans" summary={loansSummary} skipped={!provided.loans}>
          <div className="space-y-1">
            {profile.loans.map((l, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3">
                <TextField className="min-w-[140px] flex-1 pb-5" label="Loan" value={l.label} onChange={(v) => set((p) => ({ ...p, loans: p.loans.map((x, j) => (j === i ? { ...x, label: v } : x)) }), "loans")} />
                <MoneyField className="min-w-[160px] flex-1" label="Still to repay" value={l.outstanding} onChange={(v) => set((p) => ({ ...p, loans: p.loans.map((x, j) => (j === i ? { ...x, outstanding: v ?? 0 } : x)) }), "loans")} />
                <RemoveButton label={`Remove ${l.label}`} onClick={() => set((p) => ({ ...p, loans: p.loans.filter((_, j) => j !== i) }), "loans")} />
              </div>
            ))}
            <AddButton onClick={() => set((p) => ({ ...p, loans: [...p.loans, { label: p.loans.length ? "Loan" : "Home loan", outstanding: 0 }] }), "loans")}>Add a loan</AddButton>
          </div>
        </Item>

        <Item
          value="family-costs"
          title="Family costs"
          skipped={!provided.familyCosts}
          summary={profile.familyCostsPerYear ? `${inrExact(profile.familyCostsPerYear)} a year without your own spending, for ${a.lifeYears} years` : "Not entered: adding them raises the gap"}
        >
          <MoneyField
            className="max-w-sm"
            label="Household costs a year, without your own spending"
            value={profile.familyCostsPerYear ?? null}
            onChange={(v) => set((p) => ({ ...p, familyCostsPerYear: v ?? undefined }), "familyCosts")}
          />
          <p className="text-[13px] text-muted-2">
            We cover these for {a.lifeYears} years at today&apos;s prices. Change the years in Adjust assumptions. <Trace id="A-LC-YEARS" />
          </p>
        </Item>

        <Item value="goals" title="Goals" summary={goalsSummary} skipped={!provided.goals}>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {GOAL_ORDER.map((k: GoalKind) => {
              const g = profile.goals.find((x) => x.kind === k);
              return (
                <MoneyField
                  key={k}
                  label={g?.label && k === "OTHER" ? g.label : GOAL_LABELS[k]}
                  value={g?.amount ?? null}
                  onChange={(v) =>
                    set((p) => {
                      const rest = p.goals.filter((x) => x.kind !== k);
                      return { ...p, goals: v ? [...rest, { kind: k, amount: v, ...(g?.label ? { label: g.label } : {}) }].sort((x, y) => GOAL_ORDER.indexOf(x.kind) - GOAL_ORDER.indexOf(y.kind)) : rest };
                    }, "goals")
                  }
                />
              );
            })}
          </div>
        </Item>

        <Item
          value="cover"
          title="Existing cover"
          trace="FR-2.4"
          skipped={!provided.existingCover}
          summary={
            <>
              {own.length ? own.map((c) => `Your own: ${c.label}, paid on death ${inrExact(c.deathSumAssured)}`).join(" · ") : "No policies of your own"}
              <br />
              {emp.length ? emp.map((c) => `From your employer: ${c.label} ${inrExact(c.deathSumAssured)}`).join(" · ") : "No employer cover"}
            </>
          }
        >
          <p className="mb-3 flex gap-2 text-[13px] text-blue">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {COVER_PROMPT}
          </p>
          <div className="space-y-3">
            {profile.existingCover.map((c, i) => {
              const type = coverTypes[i] ?? "DEATH";
              const rejected = type !== "DEATH";
              return (
                <div key={i} className={cn("rounded-2xl border p-3", rejected ? "border-warn bg-warn-soft" : "border-line")}>
                  <div className="grid gap-x-3 sm:grid-cols-2">
                    <SelectField
                      label="Whose cover"
                      value={c.kind}
                      options={[
                        { value: "OWN", label: "Your own policy" },
                        { value: "EMPLOYER", label: "From your employer" },
                      ]}
                      onChange={(v) => set((p) => ({ ...p, existingCover: p.existingCover.map((x, j) => (j === i ? { ...x, kind: v } : x)) }), "existingCover")}
                    />
                    {c.kind === "OWN" ? (
                      <SelectField
                        label="Type"
                        value={c.productCategory ?? "TERM"}
                        options={CATEGORY_OPTIONS}
                        onChange={(v) => set((p) => ({ ...p, existingCover: p.existingCover.map((x, j) => (j === i ? { ...x, productCategory: v } : x)) }), "existingCover")}
                      />
                    ) : (
                      <TextField label="Name" value={c.label} onChange={(v) => set((p) => ({ ...p, existingCover: p.existingCover.map((x, j) => (j === i ? { ...x, label: v } : x)) }), "existingCover")} />
                    )}
                    <SelectField
                      className="mt-3"
                      label="What is this amount?"
                      value={type}
                      options={[
                        { value: "DEATH", label: "Paid if I die (death cover)" },
                        { value: "MATURITY", label: "Maturity value" },
                        { value: "PREMIUM", label: "Premium I pay" },
                      ]}
                      onChange={(v) => {
                        setCoverTypes((t) => ({ ...t, [i]: v }));
                        const check = acceptCoverEntry({ amount: c.deathSumAssured, amountType: v });
                        if (!check.accepted) {
                          setPendingCover((pc) => ({ ...pc, [i]: c.deathSumAssured || pc[i] || null }));
                          set((p) => ({ ...p, existingCover: p.existingCover.map((x, j) => (j === i ? { ...x, deathSumAssured: 0 } : x)) }), "existingCover");
                          log("input.cover", { note: `${c.label} entered as ${v === "MATURITY" ? "maturity value" : "premium"}; prompted for the amount paid on death` }, check.code);
                        } else if (pendingCover[i]) {
                          set((p) => ({ ...p, existingCover: p.existingCover.map((x, j) => (j === i ? { ...x, deathSumAssured: pendingCover[i] ?? 0 } : x)) }), "existingCover");
                          log("input.cover", { note: `${c.label}: replaced with death cover ${inr(pendingCover[i] ?? 0)}` }, "V-COVER-01");
                          setPendingCover((pc) => ({ ...pc, [i]: null }));
                        }
                      }}
                    />
                    <div className="mt-3 flex items-end gap-3">
                      <MoneyField
                        className="flex-1"
                        label={rejected ? "Amount (not counted)" : "Amount paid on death"}
                        value={rejected ? pendingCover[i] ?? null : c.deathSumAssured}
                        invalid={rejected}
                        onChange={(v) => {
                          if (rejected) setPendingCover((pc) => ({ ...pc, [i]: v }));
                          else set((p) => ({ ...p, existingCover: p.existingCover.map((x, j) => (j === i ? { ...x, deathSumAssured: v ?? 0 } : x)) }), "existingCover");
                        }}
                      />
                      <RemoveButton label="Remove this cover" onClick={() => set((p) => ({ ...p, existingCover: p.existingCover.filter((_, j) => j !== i) }), "existingCover")} />
                    </div>
                  </div>
                  {rejected ? (
                    <p className="text-[13px] font-medium text-warn-ink" role="alert">
                      {COVER_PROMPT} Enter the death cover from your policy document instead. <Trace id="V-COVER-01" />
                    </p>
                  ) : null}
                </div>
              );
            })}
            <AddButton onClick={() => set((p) => ({ ...p, existingCover: [...p.existingCover, { kind: "OWN", label: "Policy", deathSumAssured: 0, productCategory: "TERM" }] }), "existingCover")}>Add cover</AddButton>
          </div>
          {emp.length && an ? (
            <div className="mt-4 rounded-2xl bg-bg-alt p-4">
              <label className="flex items-center justify-between gap-3">
                <span className="font-semibold">What if I change jobs?</span>
                <input type="checkbox" role="switch" className="size-5" checked={employerLostView} onChange={(e) => setEmployerLostView(e.target.checked)} />
              </label>
              {employerLostView && employerLost?.ok ? (
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-white p-3">
                    <dt className="text-muted-2">Gap today</dt>
                    <dd className="num mt-1 font-display text-xl font-semibold">{inr(an.recon.gap)}</dd>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <dt className="text-muted-2">If employer cover ends</dt>
                    <dd className="num mt-1 font-display text-xl font-semibold text-warn">{inr(employerLost.value.recon.gap)}</dd>
                  </div>
                </dl>
              ) : null}
              <p className="mt-2 text-[13px] text-muted-2">
                Group cover usually ends when you leave the job. <Trace id="TC-15" />
              </p>
            </div>
          ) : null}
        </Item>

        <Item
          value="assets"
          title="Savings set aside for needs"
          trace="FR-2.5"
          skipped={!provided.assets}
          summary={
            profile.assets.length
              ? profile.assets.map((s) => `${s.label} ${inrExact(s.value)} → ${s.allocatedTo ? NEED_TARGET_LABELS[s.allocatedTo as keyof typeof NEED_TARGET_LABELS] : s.kind === "RETIREMENT" ? "not used (retirement money is left out by default)" : "not used"}`).join(" · ")
              : "No savings entered"
          }
        >
          <p className="mb-3 text-[13px] text-muted">Each savings pot can only be used once, for one need, and never above its value.</p>
          <div className="space-y-3">
            {profile.assets.map((s, i) => {
              const alloc = an?.recon.allocations[i];
              const options = [{ value: "", label: "Not used" }, ...needKeys.map((k) => ({ value: k, label: `→ ${NEED_TARGET_LABELS[k]}` }))];
              if (s.allocatedTo && !needKeys.includes(s.allocatedTo as never)) options.push({ value: s.allocatedTo, label: `→ ${NEED_TARGET_LABELS[s.allocatedTo as keyof typeof NEED_TARGET_LABELS] ?? s.allocatedTo} (nothing to fund)` });
              return (
                <div key={i} className="rounded-2xl border border-line p-3">
                  <div className="grid gap-x-3 sm:grid-cols-2">
                    <TextField label="Savings pot" value={s.label} onChange={(v) => set((p) => ({ ...p, assets: p.assets.map((x, j) => (j === i ? { ...x, label: v } : x)) }), "assets")} />
                    <SelectField
                      label="Kind"
                      value={s.kind}
                      options={[
                        { value: "LIQUID", label: "Savings or investments" },
                        { value: "RETIREMENT", label: "Retirement money (EPF, PPF, NPS)" },
                      ]}
                      onChange={(v) => set((p) => ({ ...p, assets: p.assets.map((x, j) => (j === i ? { ...x, kind: v, allocatedTo: v === "RETIREMENT" ? null : x.allocatedTo } : x)) }), "assets")}
                    />
                    <MoneyField className="mt-3" label="Value" value={s.value} onChange={(v) => set((p) => ({ ...p, assets: p.assets.map((x, j) => (j === i ? { ...x, value: v ?? 0 } : x)) }), "assets")} />
                    <div className="mt-3 flex items-end gap-3">
                      <SelectField
                        className="flex-1 pb-5"
                        label="Set aside for"
                        value={(s.allocatedTo ?? "") as string}
                        options={options}
                        onChange={(v) => {
                          set((p) => ({ ...p, assets: p.assets.map((x, j) => (j === i ? { ...x, allocatedTo: (v || null) as Profile["assets"][number]["allocatedTo"] } : x)) }), "assets");
                          log("input.assets", { note: `${s.label} → ${v ? NEED_TARGET_LABELS[v as keyof typeof NEED_TARGET_LABELS] : "not used"}` }, s.kind === "RETIREMENT" ? "A-ASSET-RET" : "FR-2.5", { coalesce: true });
                        }}
                      />
                      <RemoveButton label={`Remove ${s.label}`} onClick={() => set((p) => ({ ...p, assets: p.assets.filter((_, j) => j !== i) }), "assets")} />
                    </div>
                  </div>
                  {alloc && alloc.note === "TRIMMED" ? (
                    <p className="text-[13px] text-warn-ink">
                      Only {inr(alloc.allocated)} of {inr(alloc.value)} is needed there; {inr(alloc.unused)} stays unused.
                    </p>
                  ) : null}
                  {alloc && alloc.note === "NO_SUCH_NEED" ? <p className="text-[13px] text-warn-ink">There&apos;s nothing to fund for that need, so this pot isn&apos;t counted.</p> : null}
                  {s.kind === "RETIREMENT" && s.allocatedTo ? <p className="text-[13px] text-warn-ink">Retirement money is usually kept for retirement. Using it here lowers your gap but leaves less for later.</p> : null}
                </div>
              );
            })}
            <AddButton onClick={() => set((p) => ({ ...p, assets: [...p.assets, { label: "Savings", value: 0, kind: "LIQUID", allocatedTo: null }] }), "assets")}>Add savings</AddButton>
          </div>
          {an
            ? an.flags
                .filter((f) => f.id === "ALLOCATION_TRIMMED" || f.id === "ALLOCATION_BLOCKED")
                .map((f, i) => (
                  <p key={i} className="sr-only">
                    {renderStep(f.message)}
                  </p>
                ))
            : null}
        </Item>

        <Item
          value="income"
          title="Income history"
          skipped={!provided.incomeHistory}
          summary={
            profile.incomeHistory.length > 1
              ? `${profile.incomeHistory.map((v) => inr(v)).join(" · ")} → we use ${an ? inr(an.income.income) : "—"}`
              : "Salaried, so we used this year's income. Self-employed? Add 3 years and we'll use the lower of the average and the latest year."
          }
        >
          <div className="grid gap-x-3 sm:grid-cols-3">
            {["2 years ago", "Last year", "This year"].map((lbl, idx) => {
              const hist = profile.incomeHistory.length === 3 ? profile.incomeHistory : [null, null, profile.incomeHistory[profile.incomeHistory.length - 1] ?? null];
              return (
                <MoneyField
                  key={lbl}
                  label={lbl}
                  value={hist[idx] as number | null}
                  onChange={(v) =>
                    set((p) => {
                      const h = p.incomeHistory.length === 3 ? [...p.incomeHistory] : [0, 0, p.incomeHistory[p.incomeHistory.length - 1] ?? 0];
                      h[idx] = v ?? 0;
                      return { ...p, incomeHistory: h, incomeBasis: "SELF_EMPLOYED" };
                    }, "incomeHistory")
                  }
                />
              );
            })}
          </div>
          {an?.income.volatile ? (
            <p className="text-[13px] text-warn-ink">
              Your income varies a lot between years. We use the lower figure and an advisor will check it. <Trace id="TC-06" />
            </p>
          ) : null}
          {profile.incomeHistory.length > 1 ? (
            <button type="button" className="mt-2 text-sm font-medium text-blue" onClick={() => set((p) => ({ ...p, incomeHistory: [p.incomeHistory[p.incomeHistory.length - 1] ?? 0], incomeBasis: "SALARIED" }), undefined)}>
              Use this year&apos;s income only
            </button>
          ) : null}
        </Item>
      </Accordion.Root>
    </section>
  );
}
