"use client";
import { useEffect, useState } from "react";

/** Debounced copy of a value (300 ms default) for "updates as you type" results. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
