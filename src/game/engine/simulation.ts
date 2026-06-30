import { resolveCombat } from "./combat";
import { resolveDefense } from "./defense";
import { resolveLoot } from "./loot";
import { resolveOffline } from "./offline";
import type { CharacterBuild, SimulationSummary } from "./types";

export function runSimulation(build: CharacterBuild, areaId: string): SimulationSummary {
  const combat = resolveCombat(build, areaId);
  const defense = resolveDefense(build, areaId);
  const loot = resolveLoot(build, areaId, combat, defense);
  const offline = resolveOffline(loot, defense);

  return {
    combat,
    defense,
    loot,
    offline,
  };
}
