"use client";
import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** true after hydration (client), false during SSR. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function subscribeUrl(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener("nf:url", cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener("nf:url", cb);
  };
}

/** Current `location.search`, re-read on popstate and on our own `nf:url` event. */
export function useSearch(): string {
  return useSyncExternalStore(
    subscribeUrl,
    () => window.location.search,
    () => "",
  );
}

/** Replace a query param without a navigation, and notify listeners. */
export function setQueryParam(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.pushState(window.history.state, "", url.toString());
  window.dispatchEvent(new Event("nf:url"));
}
