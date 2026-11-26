"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Route error boundary. Never shows stack traces or financial values. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-20 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-3 font-display text-3xl font-bold">This page couldn&apos;t load</h1>
      <p className="mt-3 text-muted">Nothing was booked or sent. Your answers are still saved in this browser tab.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/estimate">Back to step 1</Link>
        </Button>
      </div>
    </div>
  );
}
