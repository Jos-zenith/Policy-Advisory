"use client";
import { useEffect, type ReactNode } from "react";
import { useMounted } from "@/lib/hooks";
import { useJourney } from "@/lib/journey-store";

/**
 * Journey state lives in sessionStorage, so pages render after hydration to
 * avoid server/client mismatches. Also makes sure an anonymous session exists.
 */
export function ClientGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const mounted = useMounted();
  const ensureSession = useJourney((s) => s.ensureSession);
  useEffect(() => {
    if (mounted) ensureSession();
  }, [mounted, ensureSession]);
  if (!mounted) return <>{fallback ?? <PageSkeleton />}</>;
  return <>{children}</>;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-[1240px] animate-pulse px-4 py-12 md:px-8" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-48 rounded bg-line" />
      <div className="mt-4 h-10 w-3/4 rounded bg-line" />
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="h-80 rounded-3xl bg-white" />
        <div className="h-80 rounded-3xl bg-white" />
      </div>
    </div>
  );
}
