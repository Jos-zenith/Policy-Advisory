import type { Metadata } from "next";
import { GapPage } from "@/components/stage2/gap-page";

export const metadata: Metadata = { title: "Step 2 · Your refined gap" };

export default function Page() {
  return <GapPage />;
}
