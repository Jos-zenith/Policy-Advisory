/**
 * Sample slot generator. Times are written in Asia/Kolkata and stored in UTC.
 * Deterministic for a given start date: the same pattern every working day,
 * with the wireframe's pre-booked times struck through.
 */
import { addDays, format, isWeekend } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import advisorsJson from "./advisors.json";
import type { Slot } from "@/engine/types";

export const TZ = "Asia/Kolkata";
export const SLOT_MINUTES = 30;

type Pattern = { time: string; booked?: boolean }[];

export function generateSlots(now: Date, workingDays = 10): Slot[] {
  // Advisors imported on reveal day may have no pattern yet: give them a default day.
  const DEFAULT: Pattern = [{ time: "10:00" }, { time: "11:30" }, { time: "15:00" }];
  const given = (advisorsJson.slotPatterns ?? {}) as Record<string, Pattern>;
  const patterns: Record<string, Pattern> = Object.fromEntries(advisorsJson.advisors.map((a) => [a.id, given[a.id] ?? DEFAULT]));
  const todayIst = toZonedTime(now, TZ);
  const out: Slot[] = [];
  let d = addDays(todayIst, 1);
  let made = 0;
  while (made < workingDays) {
    if (!isWeekend(d)) {
      const day = format(d, "yyyy-MM-dd");
      for (const [advisorId, pattern] of Object.entries(patterns)) {
        for (const p of pattern) {
          const start = fromZonedTime(`${day}T${p.time}:00`, TZ);
          const end = new Date(start.getTime() + SLOT_MINUTES * 60_000);
          out.push({
            id: `SL-${advisorId.replace("ADV-", "")}-${day.replace(/-/g, "")}-${p.time.replace(":", "")}`,
            advisorId,
            startUtc: start.toISOString(),
            endUtc: end.toISOString(),
            capacity: 1,
            booked: p.booked ? 1 : 0,
          });
        }
      }
      made++;
    }
    d = addDays(d, 1);
  }
  return out;
}
