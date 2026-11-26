import Link from "next/link";
import { ArrowRight } from "lucide-react";
import copy from "@/config/content/journey.json";
import { Button } from "@/components/ui/button";
import { MiniVerdict } from "@/components/landing/mini-verdict";

export default function Home() {
  const l = copy.landing;
  return (
    <div>
      <section className="bg-bg">
        <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-4 py-12 md:px-8 md:py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="eyebrow">{l.eyebrow}</p>
            <h1 className="mt-4 font-display text-[40px] font-bold leading-[1.05] tracking-tight text-ink md:text-[64px]">{l.headline}</h1>
            <p className="mt-5 font-display text-xl font-medium text-blue md:text-2xl">{l.sub}</p>
            <p className="mt-4 max-w-[520px] text-[17px] leading-7 text-muted">{l.body}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg">
                <Link href="/estimate">
                  {l.cta} <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Link href="/judges#formulas" className="font-semibold text-blue underline-offset-4 hover:underline">
                {l.secondary}
              </Link>
            </div>
          </div>
          <MiniVerdict title={l.miniTitle} />
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-14 md:px-8" aria-labelledby="how">
        <p className="eyebrow">{l.howItWorksEyebrow}</p>
        <h2 id="how" className="mt-3 font-display text-[28px] font-semibold md:text-[34px]">
          {l.howItWorksTitle}
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {l.steps.map((s) => (
            <li key={s.n} className="card p-6">
              <p className="eyebrow">Step {s.n}</p>
              <h3 className="mt-2 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-6 text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
