import type { Metadata } from "next";
import { OptionsPage } from "@/components/stage3/options-page";

export const metadata: Metadata = { title: "Step 3 · Options" };

export default function Page() {
  return <OptionsPage />;
}
