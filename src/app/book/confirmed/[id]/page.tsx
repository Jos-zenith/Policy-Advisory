import type { Metadata } from "next";
import { ConfirmedView } from "@/components/booking/confirmed-view";

export const metadata: Metadata = { title: "Booking confirmed" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConfirmedView id={id} />;
}
