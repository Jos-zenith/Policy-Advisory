/** The sample data must already conform to the canonical schema (CLAUDE.md §16). */
import { describe, expect, it } from "vitest";
import { AdvisorSchema, ProductSchema, ProfileSchema, RateTableSchema, SlotSchema } from "@/data/schemas";
import { CATALOG } from "@/data/catalog";
import advisorsJson from "@/data/canonical/advisors.json";
import personasJson from "@/config/content/personas.json";
import { generateSlots } from "@/data/canonical/slots.seed";

describe("canonical sample data", () => {
  it("6 products validate and each has a rate table", () => {
    expect(CATALOG.products).toHaveLength(6);
    for (const p of CATALOG.products) {
      expect(() => ProductSchema.parse(p)).not.toThrow();
      expect(p.isSample).toBe(true);
      expect(CATALOG.rateTables.some((t) => t.id === p.rateTableId && t.productId === p.id)).toBe(true);
    }
  });
  it("rate tables validate and cells carry exactly the declared dims", () => {
    for (const t of CATALOG.rateTables) {
      expect(() => RateTableSchema.parse(t)).not.toThrow();
      for (const c of t.cells) expect(Object.keys(c.key).sort()).toEqual([...t.dims].sort());
    }
  });
  it("advisors validate; one has an expired licence for the visibility test", () => {
    for (const a of advisorsJson.advisors) expect(() => AdvisorSchema.parse(a)).not.toThrow();
    expect(advisorsJson.advisors.some((a) => a.licenceValidTo < "2026-11-01")).toBe(true);
  });
  it("persona profiles validate (except the deliberate invalid-input persona's values)", () => {
    for (const p of personasJson.personas) expect(() => ProfileSchema.parse(p.profile)).not.toThrow();
  });
  it("slots are deterministic, weekday-only and in UTC", () => {
    const a = generateSlots(new Date("2026-11-26T05:00:00Z"));
    const b = generateSlots(new Date("2026-11-26T05:00:00Z"));
    expect(a).toEqual(b);
    for (const s of a) expect(() => SlotSchema.parse(s)).not.toThrow();
    // Thu 3 Dec 2026, 11:00 IST = 05:30 UTC
    expect(a.find((s) => s.id === "SL-PR-20261203-1100")?.startUtc).toBe("2026-12-03T05:30:00.000Z");
  });
});
