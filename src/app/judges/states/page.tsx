import type { Metadata } from "next";
import Link from "next/link";
import { StatesBoard } from "@/components/judges/states-board";

export const metadata: Metadata = { title: "Decision states board" };

export default function StatesPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
      <Link href="/judges" className="font-semibold text-blue">
        ← Judge&apos;s guide
      </Link>
      <h1 className="mt-3 font-display text-[34px] font-bold">Decision states board</h1>
      <p className="mt-2 max-w-[760px] text-[15px] text-muted">
        One live persona for every state the rules can reach. Each card is computed now by the same engine and sample data as the journey; &quot;Open this scenario&quot; loads the persona (with Judge mode on) and goes to the page where the state shows.
      </p>
      <div className="mt-8">
        <StatesBoard />
      </div>
    </div>
  );
}
