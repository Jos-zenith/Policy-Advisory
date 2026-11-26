import type { Metadata } from "next";
import { SummaryPage } from "@/components/summary/summary-page";

export const metadata: Metadata = { title: "Print summary" };

export default function Page() {
  return <SummaryPage />;
}
