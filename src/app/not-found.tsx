import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-20 text-center">
      <p className="eyebrow">Page not found</p>
      <h1 className="mt-3 font-display text-3xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-muted">Your answers are still saved in this browser tab.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild>
          <Link href="/estimate">Back to your estimate</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
