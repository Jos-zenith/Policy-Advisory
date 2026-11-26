"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronDown, X } from "lucide-react";
import consent from "@/config/content/consent.json";
import { ENGINE_CONFIG } from "@/config";
import { buildHandoffSnapshot, buildQuestions, describeResult, evaluateComprehension, resultLevel, type RulesOutcome } from "@/engine";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trace } from "@/components/ui/trace";
import { HandoffBody } from "@/components/handoff/handoff-view";
import { useJourney } from "@/lib/journey-store";
import { useAnalysis } from "@/lib/use-engine";
import { useCatalog } from "@/components/stage3/use-options";
import { CustomerSchema, MOBILE_RE, normaliseMobile } from "@/server/booking-schema";
import { RealityCheck } from "./reality-check";
import { AdvisorPicker, whenLabel, timeLabel, type Picked } from "./advisor-picker";
import { cn } from "@/lib/cn";

type StepId = 1 | 2 | 3;

function StepShell({ n, title, trace, open, done, summary, onOpen, children }: { n: StepId; title: string; trace: string[]; open: boolean; done: boolean; summary: string; onOpen: () => void; children: ReactNode }) {
  return (
    <section className={cn("rounded-3xl border bg-white", open ? "border-ink/60" : "border-line")} aria-labelledby={`step-${n}`}>
      <h3 id={`step-${n}`}>
        <button type="button" onClick={onOpen} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left md:px-6">
          <span className="flex min-w-0 items-center gap-3">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold", done ? "bg-blue text-white" : "border border-line text-muted")}>{done ? <Check className="size-4" aria-label="done" /> : n}</span>
            <span className="min-w-0">
              <span className="block font-display text-[18px] font-semibold">
                {n} · {title}
              </span>
              {!open && summary ? <span className="block truncate text-[14px] text-muted">{summary}</span> : null}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <Trace id={trace} />
            <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} aria-hidden />
          </span>
        </button>
      </h3>
      {open ? <div className="px-5 pb-6 md:px-6">{children}</div> : null}
    </section>
  );
}

export function BookingDrawer({ rules, onClose }: { rules: RulesOutcome; onClose: () => void }) {
  const router = useRouter();
  const catalog = useCatalog();
  const { result, profile, assumptions } = useAnalysis();
  const sessionId = useJourney((s) => s.sessionId);
  const answers = useJourney((s) => s.comprehension.answers);
  const log = useJourney((s) => s.log);
  const [open, setOpen] = useState<StepId>(rules.selection ? 1 : 2);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("English");
  const [consents, setConsents] = useState({ prepare: false, share: false, contact: false });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<{ id: string; advisorName: string; startUtc: string }[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [preview, setPreview] = useState(false);
  const [touched, setTouched] = useState(false);
  const keyRef = useRef<string | null>(null);

  const product = catalog?.products.find((p) => p.id === rules.selection?.productId);
  const questions = useMemo(() => (rules.selection && product ? buildQuestions({ cover: rules.selection.cover, category: product.category }, ENGINE_CONFIG) : []), [rules.selection, product]);
  const comp = useMemo(() => evaluateComprehension(questions, answers), [questions, answers]);

  // check.result: log once the three questions are settled.
  useEffect(() => {
    if (questions.length && comp.complete) log("check.result", { summary: describeResult(questions, comp), score: comp.score }, "FR-5.2", { coalesce: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp.complete, comp.score, comp.answered]);

  const mobileNorm = normaliseMobile(mobile);
  const customer = { name: name.trim(), mobile: mobileNorm, email: email.trim(), language };
  const customerCheck = CustomerSchema.safeParse(customer);
  const fieldErr = (path: string) => (touched && !customerCheck.success ? customerCheck.error.issues.find((i) => i.path[0] === path)?.message : undefined);
  const allConsents = consents.prepare && consents.share && consents.contact;
  const canConfirm = !!picked && customerCheck.success && allConsents && !submitting;

  const snapshot = useMemo(() => {
    if (!result.ok || !catalog) return null;
    const names = Object.fromEntries(catalog.products.map((p) => [p.id, { name: p.name, category: p.category }]));
    const ep = useJourney.getState().existingPolicy;
    return buildHandoffSnapshot({
      analysis: result.value,
      rules,
      profile,
      assumptions,
      config: ENGINE_CONFIG,
      productNames: names,
      comprehensionAnswers: answers,
      existingPolicy: ep ? { name: ep.name, category: ep.category, deathSumAssured: ep.deathSumAssured, annualPremium: ep.annualPremium, policyTerm: ep.policyTerm, policyYear: ep.policyYear } : null,
      resultLevel: resultLevel(useJourney.getState().provided).level,
      now: new Date().toISOString(),
    });
  }, [result, catalog, rules, profile, assumptions, answers]);

  const pick = (p: Picked) => {
    setPicked(p);
    keyRef.current = null; // a new slot gets a new idempotency key
    setAlternatives([]);
    setErrorMsg(null);
    if (p.advisor.languages.includes(language) === false) setLanguage(p.advisor.languages[0]);
  };

  async function confirm() {
    setTouched(true);
    if (!canConfirm || !picked || !sessionId) return;
    setSubmitting(true);
    setErrorMsg(null);
    if (!keyRef.current) keyRef.current = `k_${crypto.randomUUID().replace(/-/g, "")}`;
    const st = useJourney.getState();
    const body = {
      sessionId,
      slotId: picked.slot.id,
      customer,
      consents: { ...consents, version: consent.version },
      journey: { profile: st.profile, assumptions: st.assumptions, provided: st.provided, options: st.options, comprehension: st.comprehension.answers, existingPolicy: st.existingPolicy },
      events: st.events,
    };
    try {
      const res = await fetch("/api/bookings", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": keyRef.current }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.status === 201 || res.status === 200) {
        router.push(`/book/confirmed/${data.booking.id}?s=${sessionId}`);
        return;
      }
      if (res.status === 409 && data.error === "slot_taken") {
        setErrorMsg("Someone has just taken that time. Here are the next free times:");
        setAlternatives(data.alternatives ?? []);
        setPicked(null);
        keyRef.current = null;
        setRefreshKey((k) => k + 1);
      } else if (res.status === 409) {
        setErrorMsg(data.reason ?? "That time isn't available any more. Please pick another.");
        setPicked(null);
        keyRef.current = null;
        setRefreshKey((k) => k + 1);
      } else {
        setErrorMsg((data.issues ?? []).map((i: { message: string }) => i.message).join(" ") || "Please check your details.");
      }
    } catch {
      setErrorMsg("We couldn't reach the server. Your booking was not made; please try again.");
    }
    setSubmitting(false);
  }

  const shareLead = consent.items.find((i) => i.id === "share")!.lead.replace("{advisor}", picked?.advisor.name ?? "your advisor");
  const step1Summary = questions.length ? `${comp.score} of 3 right first time${comp.complete ? "" : ` · ${3 - comp.answered} to go`}` : "Skipped: no product chosen yet";
  const step2Summary = picked ? `${picked.advisor.name} · ${whenLabel(picked.slot.startUtc)}` : "";
  const step3Summary = customerCheck.success && allConsents ? `${customer.name} · ${customer.language} · 3 consents` : "";

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} full width="md:max-w-[1080px]" title="Book a free 30-minute call" description="Your advisor gets your summary beforehand, so you won't start from scratch. This is the only step that asks for your contact details.">
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <StepShell n={1} title="Quick reality check" trace={["FR-5.1", "FR-5.2"]} open={open === 1} done={comp.complete} summary={step1Summary} onOpen={() => setOpen(1)}>
            {questions.length ? <RealityCheck questions={questions} result={comp} /> : <p className="text-muted">Pick a product in Options first, or carry on: the advisor will cover the basics with you.</p>}
            <Button className="mt-5" onClick={() => setOpen(2)}>
              Continue
            </Button>
          </StepShell>
          <StepShell n={2} title="Choose an advisor and time" trace={["FR-7.1", "FR-7.2"]} open={open === 2} done={!!picked} summary={step2Summary} onOpen={() => setOpen(2)}>
            <AdvisorPicker
              picked={picked}
              refreshKey={refreshKey}
              onPick={(p) => {
                pick(p);
                setOpen(3);
              }}
            />
          </StepShell>
          <StepShell n={3} title="Your details and consent" trace={["FR-7.3", "§6.1 row 6"]} open={open === 3} done={!!step3Summary} summary={step3Summary} onOpen={() => setOpen(3)}>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()} noValidate>
              <label className="block text-[14px] font-medium">
                Your name
                <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} aria-invalid={!!fieldErr("name")} className="mt-1 h-11 w-full rounded-xl border border-line px-3 font-normal" />
                {fieldErr("name") ? <span className="mt-1 block text-[13px] font-normal text-warn-ink">{fieldErr("name")}</span> : null}
              </label>
              <label className="block text-[14px] font-medium">
                Mobile number
                <input autoComplete="tel" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} onBlur={() => setTouched(true)} aria-invalid={!!fieldErr("mobile")} className="mt-1 h-11 w-full rounded-xl border border-line px-3 font-normal" />
                {fieldErr("mobile") ? <span className="mt-1 block text-[13px] font-normal text-warn-ink">{fieldErr("mobile")}</span> : MOBILE_RE.test(mobileNorm) ? null : <span className="mt-1 block text-[12px] font-normal text-muted-2">10 digits, e.g. 98765 43210</span>}
              </label>
              <label className="block text-[14px] font-medium">
                Email (optional)
                <input autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldErr("email")} className="mt-1 h-11 w-full rounded-xl border border-line px-3 font-normal" />
                {fieldErr("email") ? <span className="mt-1 block text-[13px] font-normal text-warn-ink">{fieldErr("email")}</span> : null}
              </label>
              <label className="block text-[14px] font-medium">
                Call language
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 font-normal">
                  {(picked?.advisor.languages ?? ["English", "Hindi"]).map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <fieldset className="sm:col-span-2">
                <legend className="sr-only">Consent</legend>
                {consent.items.map((c) => (
                  <label key={c.id} className="flex gap-3 border-t border-line py-3 text-[14px] leading-6 first:border-t-0">
                    <input type="checkbox" className="mt-1 size-5 shrink-0" checked={consents[c.id as keyof typeof consents]} onChange={(e) => setConsents((s) => ({ ...s, [c.id]: e.target.checked }))} />
                    <span>
                      <strong>{c.id === "share" ? shareLead : c.lead}</strong> {c.body}
                    </span>
                  </label>
                ))}
                <p className="mt-1 text-[13px] text-muted-2">{consent.footer}</p>
              </fieldset>
            </form>
          </StepShell>
        </div>

        <aside className="rounded-3xl border border-line bg-white p-5 lg:sticky lg:top-0" aria-label="Your booking">
          <h3 className="font-display text-xl font-semibold">Your booking</h3>
          <div className="mt-3 rounded-2xl bg-bg-alt p-4">
            {picked ? (
              <>
                <p className="font-semibold">{whenLabel(picked.slot.startUtc)}</p>
                <p className="text-[14px] text-muted">{picked.advisor.name} · 30 minutes · phone or video</p>
              </>
            ) : (
              <p className="text-[14px] text-muted">Choose an advisor and time in step 2.</p>
            )}
          </div>
          <p className="mt-3 text-[14px] leading-6 text-muted">
            {consent.preview}{" "}
            <button type="button" className="font-medium text-blue underline" onClick={() => setPreview(true)} disabled={!snapshot}>
              Preview what they see
            </button>
          </p>
          {errorMsg ? (
            <div className="mt-3 rounded-xl bg-warn-soft p-3 text-[14px] text-warn-ink" role="alert">
              {errorMsg}
              {alternatives.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {alternatives.map((a) => (
                    <button key={a.id} type="button" className="rounded-lg border border-warn bg-white px-2 py-1 text-[13px]" onClick={() => { setOpen(2); setErrorMsg(`Pick ${a.advisorName} at ${timeLabel(a.startUtc)} in step 2.`); }}>
                      {a.advisorName} · {whenLabel(a.startUtc)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {touched && !canConfirm && !submitting ? (
            <ul className="mt-3 list-disc pl-5 text-[13px] text-warn-ink">
              {!picked ? <li>Choose a time</li> : null}
              {!customerCheck.success ? <li>Add your name and mobile</li> : null}
              {!allConsents ? <li>Tick the three consents</li> : null}
            </ul>
          ) : null}
          <Button className="mt-4 w-full" size="lg" onClick={confirm} disabled={submitting} aria-disabled={!canConfirm} data-testid="confirm-booking">
            {submitting ? "Booking…" : "Confirm booking"}
          </Button>
          <p className="mt-3 text-[13px] leading-5 text-muted-2">{consent.raceNote}</p>
        </aside>
      </div>

      <Dialog.Root open={preview} onOpenChange={setPreview}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/50" />
          <Dialog.Content className="fixed inset-2 z-[70] overflow-y-auto rounded-3xl bg-white p-5 md:inset-10 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="font-display text-2xl font-semibold">What your advisor will see</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted">The same one-page summary, built from your answers. Your name and number appear only on the booking record.</Dialog.Description>
              </div>
              <Dialog.Close className="rounded-full p-2 hover:bg-bg-alt" aria-label="Close preview">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <div className="mt-6">{snapshot ? <HandoffBody s={snapshot} /> : null}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Sheet>
  );
}
