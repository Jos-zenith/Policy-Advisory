/**
 * Versioned config loader. Builds the typed EngineConfig that callers pass
 * into the pure engine. The engine never imports this file.
 */
import assumptionsJson from "./assumptions.json";
import bandsJson from "./bands.json";
import surrenderJson from "./surrender.json";
import rulesJson from "./rules.json";
import { defaultAssumptions } from "@/engine/assumptions";
import type { AssumptionDef, Assumptions, EngineConfig } from "@/engine/types";

export const CONFIG_VERSION = assumptionsJson.configVersion;

for (const v of [bandsJson.configVersion, surrenderJson.configVersion, rulesJson.configVersion]) {
  if (v !== CONFIG_VERSION) throw new Error(`Config version mismatch: ${v} vs ${CONFIG_VERSION}`);
}

export const ASSUMPTION_DEFS = assumptionsJson.assumptions as AssumptionDef[];

export const ENGINE_CONFIG: EngineConfig = {
  configVersion: CONFIG_VERSION,
  assumptionDefs: ASSUMPTION_DEFS,
  bands: bandsJson as unknown as EngineConfig["bands"],
  surrender: {
    schedules: surrenderJson.schedules as EngineConfig["surrender"]["schedules"],
    earlyYearsForCopy: surrenderJson.earlyYearsForCopy as [number, number],
    cardDisplayYears: surrenderJson.cardDisplayYears,
    cardIllustrationPremium: surrenderJson.cardIllustrationPremium,
    illustrative: surrenderJson.illustrative,
  },
  rules: rulesJson as unknown as EngineConfig["rules"],
};

export const DEFAULT_ASSUMPTIONS: Assumptions = defaultAssumptions(ASSUMPTION_DEFS);
