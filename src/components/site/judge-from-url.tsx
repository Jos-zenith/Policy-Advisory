"use client";
import { useEffect } from "react";
import { useJudge } from "@/lib/judge-store";

/** `?judge=1` turns Judge mode on (and `?judge=0` off); otherwise the stored choice is kept. */
export function JudgeModeFromUrl() {
  const set = useJudge((s) => s.set);
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("judge");
    if (v === "1") set(true);
    if (v === "0") set(false);
  }, [set]);
  return null;
}
