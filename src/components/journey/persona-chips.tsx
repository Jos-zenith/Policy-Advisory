"use client";
import personasJson from "@/config/content/personas.json";
import { useJourney } from "@/lib/journey-store";
import { cn } from "@/lib/cn";

/** Demo persona chips (FR-1.1). Loading a persona fills every stage. */
export function PersonaChips({ onPick, dark = false }: { onPick?: (id: string) => void; dark?: boolean }) {
  const personaId = useJourney((s) => s.personaId);
  const loadPersona = useJourney((s) => s.loadPersona);
  const chips = personasJson.personas.filter((p) => p.chip);
  return (
    <div className="flex flex-wrap gap-2.5" role="group" aria-label="Demo personas">
      {chips.map((p) => {
        const active = p.id === personaId;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={active}
            onClick={() => {
              loadPersona(p.id);
              onPick?.(p.id);
            }}
            className={cn(
              "rounded-2xl border px-4 py-2.5 text-left transition-colors",
              active ? "border-ink bg-ink text-white" : dark ? "border-white/30 bg-white/5 text-white hover:bg-white/10" : "border-line bg-white text-ink hover:bg-bg-alt",
            )}
          >
            <span className="block text-[15px] font-semibold leading-5">{p.name}</span>
            <span className={cn("block text-[13px] leading-5", active ? "text-white/80" : dark ? "text-white/70" : "text-muted-2")}>{p.tagline}</span>
          </button>
        );
      })}
    </div>
  );
}
