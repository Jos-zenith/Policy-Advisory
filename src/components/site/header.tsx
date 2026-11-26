"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { useSearch } from "@/lib/hooks";
import ui from "@/config/content/ui.json";
import { useJudge } from "@/lib/judge-store";
import { useJudgeOn } from "@/components/ui/trace";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";

function useCurrentStep(): number {
  const pathname = usePathname();
  const book = new URLSearchParams(useSearch()).get("book") === "1";
  if (pathname.startsWith("/book")) return 4;
  if (pathname.startsWith("/options")) return book ? 4 : 3;
  if (pathname.startsWith("/gap")) return 2;
  if (pathname.startsWith("/estimate")) return 1;
  return 0;
}

export function JudgeToggle({ dark = false }: { dark?: boolean }) {
  const toggle = useJudge((s) => s.toggle);
  const on = useJudgeOn();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      className={cn("no-print flex items-center gap-2 rounded-full px-2 py-1 text-sm", dark ? "text-white/90 hover:bg-white/10" : "text-muted hover:bg-bg-alt")}
      title={on ? ui.judgeMode.onHint : ui.judgeMode.offHint}
    >
      <span className={cn("relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-blue" : dark ? "bg-white/25" : "bg-line")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
      <span className="hidden sm:inline">{ui.judgeMode.label}</span>
    </button>
  );
}

function Stepper({ current }: { current: number }) {
  const steps = ui.stepper;
  return (
    <>
      <nav aria-label="Journey steps" className="hidden lg:block">
        <ol className="flex items-center gap-2">
          {steps.map((s, i) => {
            const n = i + 1;
            const done = current > n;
            const active = current === n;
            return (
              <li key={s.id}>
                <Link
                  href={s.href}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-full border px-1.5 pr-4 text-[15px] transition-colors",
                    active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-bg-alt",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-full text-[13px] font-semibold",
                      active ? "bg-white text-ink" : done ? "bg-blue text-white" : "border border-line text-muted",
                    )}
                  >
                    {done ? <Check className="size-4" aria-label="done" /> : n}
                  </span>
                  <span className="font-medium">{s.label}</span>
                  {s.optional && !done ? <span className={cn("text-xs", active ? "text-white/75" : "text-muted-2")}>optional</span> : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
      {current > 0 ? (
        <nav aria-label="Journey steps" className="lg:hidden">
          <Link href={steps[current - 1].href} className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm">
            <span className="font-semibold">
              Step {current} of {steps.length}
            </span>
            <span className="text-muted-2">· {steps[current - 1].label}</span>
          </Link>
        </nav>
      ) : null}
    </>
  );
}

function AdvisorHeader() {
  return (
    <header data-site-header className="no-print bg-ink text-white">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 md:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Logo dark />
          </Link>
          <span className="hidden border-l border-white/30 pl-3 text-sm text-white/85 sm:inline">Advisor workspace</span>
        </div>
        <div className="flex items-center gap-3">
          <JudgeToggle dark />
        </div>
      </div>
    </header>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const current = useCurrentStep();
  if (pathname.startsWith("/advisor")) return <AdvisorHeader />;
  const isJudges = pathname.startsWith("/judges");
  return (
    <header data-site-header className="no-print sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-4 md:h-[68px] md:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${ui.brand} home`}>
          <Logo />
        </Link>
        {isJudges ? null : <Stepper current={current} />}
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <JudgeToggle />
          {isJudges ? (
            <Link href="/?judge=1" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">
              Start the demo
            </Link>
          ) : (
            <Link href="/judges" className="hidden text-[15px] font-medium text-blue underline underline-offset-4 sm:inline">
              Judge&apos;s guide
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
