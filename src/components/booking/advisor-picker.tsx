"use client";
import { useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import consent from "@/config/content/consent.json";
import ui from "@/config/content/ui.json";
import { cn } from "@/lib/cn";

export const TZ = "Asia/Kolkata";

export interface AdvisorDTO {
  id: string;
  name: string;
  languages: string[];
  specialities: string[];
  licenceRef: string;
  licenceValidTo: string | null;
  isSample: boolean;
}
export interface SlotDTO {
  id: string;
  advisorId: string;
  startUtc: string;
  endUtc: string;
  free: boolean;
}
export interface Picked {
  slot: SlotDTO;
  advisor: AdvisorDTO;
}

export const dayLabel = (ymd: string) => formatInTimeZone(new Date(`${ymd}T06:30:00Z`), TZ, "EEE d MMM");
export const timeLabel = (utc: string) => formatInTimeZone(new Date(utc), TZ, "HH:mm");
export const whenLabel = (utc: string) => formatInTimeZone(new Date(utc), TZ, "EEE d MMM, HH:mm");
const validLabel = (ymd: string | null) => (ymd ? formatInTimeZone(new Date(`${ymd}T06:30:00Z`), TZ, "MMM yyyy") : "not verified");
const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function AdvisorPicker({ picked, onPick, refreshKey }: { picked: Picked | null; onPick: (p: Picked) => void; refreshKey: number }) {
  const [days, setDays] = useState<string[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [advisors, setAdvisors] = useState<{ advisor: AdvisorDTO; slots: SlotDTO[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState("Any");
  const [spec, setSpec] = useState("Any");

  useEffect(() => {
    let alive = true;
    fetch(`/api/slots${day ? `?day=${day}` : ""}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { days: string[]; day: string | null; advisors: { advisor: AdvisorDTO; slots: SlotDTO[] }[] }) => {
        if (!alive) return;
        setDays(d.days);
        if (!day && d.day) setDay(d.day);
        setAdvisors(d.advisors);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        if (alive) {
          setError("We couldn't load times just now. Please try again.");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [day, refreshKey]);

  const languages = useMemo(() => ["Any", ...Array.from(new Set(advisors.flatMap((a) => a.advisor.languages)))], [advisors]);
  const specialities = useMemo(() => ["Any", ...Array.from(new Set(advisors.flatMap((a) => a.advisor.specialities)))], [advisors]);
  const shown = advisors.filter((a) => (lang === "Any" || a.advisor.languages.includes(lang)) && (spec === "Any" || a.advisor.specialities.includes(spec)));

  return (
    <div>
      <p className="text-[14px] font-semibold">Language</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter by language">
        {languages.map((l) => (
          <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={cn("h-10 rounded-full border px-4 text-[14px]", lang === l ? "border-ink bg-ink text-white" : "border-line hover:bg-bg-alt")}>
            {l}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[14px] font-semibold">
          Speciality
          <select value={spec} onChange={(e) => setSpec(e.target.value)} className="h-10 rounded-full border border-line bg-white px-3 font-normal">
            {specialities.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[14px] font-semibold">
          Day
          <select value={day ?? ""} onChange={(e) => setDay(e.target.value)} className="h-10 rounded-full border border-line bg-white px-3 font-normal" aria-label="Day">
            {days.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className="mt-6 text-muted">Loading times…</p> : null}
      {error ? (
        <p className="mt-6 rounded-xl bg-warn-soft p-3 text-warn-ink" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && shown.length === 0 ? <p className="mt-6 text-muted">No advisors match these filters on this day. Try another language or day.</p> : null}

      <ul className="mt-4 space-y-3">
        {shown.map(({ advisor: a, slots }) => (
          <li key={a.id} className="rounded-2xl border border-line p-4" data-advisor={a.id}>
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-soft font-semibold text-blue" aria-hidden>
                {initials(a.name)}
              </span>
              <div className="min-w-0">
                <p className="font-semibold">
                  {a.name} {a.isSample ? <span className="ml-1 rounded bg-bg-alt px-1.5 py-0.5 text-[11px] font-medium text-muted-2">Sample</span> : null}
                </p>
                <p className="text-[14px] text-muted">
                  {a.specialities.join(", ")} · {a.languages.join(", ")}
                </p>
                <p className="text-[12px] text-muted-2">
                  Licence {a.licenceRef} · valid to {validLabel(a.licenceValidTo)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {slots.map((s) => {
                const active = picked?.slot.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!s.free}
                    aria-pressed={active}
                    aria-label={`${a.name}, ${whenLabel(s.startUtc)}${s.free ? "" : ", already booked"}`}
                    onClick={() => onPick({ slot: s, advisor: a })}
                    className={cn("num h-11 min-w-[76px] rounded-xl border px-3 text-[14px] font-semibold", active ? "border-ink bg-ink text-white" : s.free ? "border-line hover:bg-bg-alt" : "border-dashed border-line bg-bg-alt text-muted-2 line-through")}
                  >
                    {timeLabel(s.startUtc)}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] leading-5 text-muted-2">
        {consent.advisorNote} {ui.advisorRemunerationPlaceholder}
      </p>
    </div>
  );
}
