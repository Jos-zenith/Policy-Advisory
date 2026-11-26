"use client";
import { usePathname } from "next/navigation";
import { useSearch } from "@/lib/hooks";
import ui from "@/config/content/ui.json";
import { CONFIG_VERSION } from "@/config";
import { Trace } from "@/components/ui/trace";

type Key = keyof typeof ui.disclaimers;

function pickKey(pathname: string, search: URLSearchParams): Key {
  if (pathname.startsWith("/advisor")) return "advisor";
  if (pathname.startsWith("/judges")) return "judges";
  if (pathname.startsWith("/book")) return "booking";
  if (pathname.startsWith("/options")) {
    if (search.get("book") === "1") return "booking";
    if (search.get("panel") === "policy") return "policy";
    return "options";
  }
  if (pathname.startsWith("/gap") || pathname.startsWith("/summary")) return "gap";
  return "default";
}

/** Disclaimer on every page (FR-8.3). Text comes from content config. */
export function SiteFooter() {
  const pathname = usePathname();
  const search = new URLSearchParams(useSearch());
  const d = ui.disclaimers[pickKey(pathname, search)];
  return (
    <footer className="mt-16 border-t border-line bg-white" role="contentinfo">
      <div className="mx-auto max-w-[1240px] px-4 py-6 text-[13px] leading-5 text-muted md:px-8">
        <p>
          {d.text.replace("{configVersion}", CONFIG_VERSION)} <Trace id={d.trace} />
        </p>
      </div>
    </footer>
  );
}
