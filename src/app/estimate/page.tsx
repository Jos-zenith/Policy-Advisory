import type { Metadata } from "next";
import { EstimatePage } from "@/components/stage1/estimate-page";

export const metadata: Metadata = { title: "Step 1 · Your first estimate" };

export default function Page() {
  return <EstimatePage />;
}
