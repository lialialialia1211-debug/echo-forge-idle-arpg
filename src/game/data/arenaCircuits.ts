import type { ArenaCircuitDef } from "../engine/topTypes";

export const arenaCircuits: ArenaCircuitDef[] = [
  {
    id: "arena_cinder_crucible",
    displayName: "Cinder Crucible",
    tier: 1,
    radius: 280,
    enemyLevel: 1,
    enemyIntegrity: 520,
    enemyImpact: 74,
    enemyGuard: 110,
    rewardMultiplier: 1,
  },
  {
    id: "arena_glass_mire_basin",
    displayName: "Glass Mire Basin",
    tier: 2,
    radius: 290,
    enemyLevel: 4,
    enemyIntegrity: 820,
    enemyImpact: 106,
    enemyGuard: 165,
    rewardMultiplier: 1.18,
  },
  {
    id: "arena_red_chancel_disk",
    displayName: "Red Chancel Disk",
    tier: 3,
    radius: 300,
    enemyLevel: 7,
    enemyIntegrity: 1260,
    enemyImpact: 148,
    enemyGuard: 240,
    rewardMultiplier: 1.38,
  },
  {
    id: "arena_null_tide_basin",
    displayName: "Null Tide Basin",
    tier: 4,
    radius: 305,
    enemyLevel: 11,
    enemyIntegrity: 1720,
    enemyImpact: 186,
    enemyGuard: 310,
    rewardMultiplier: 1.58,
  },
  {
    id: "arena_resonant_apex",
    displayName: "Resonant Apex",
    tier: 5,
    radius: 310,
    enemyLevel: 15,
    enemyIntegrity: 2260,
    enemyImpact: 235,
    enemyGuard: 390,
    rewardMultiplier: 1.82,
  },
];

export function getArenaCircuitDef(arenaId: string): ArenaCircuitDef {
  const arena = arenaCircuits.find((entry) => entry.id === arenaId);
  if (!arena) {
    throw new Error(`Unknown arena circuit: ${arenaId}`);
  }
  return arena;
}
