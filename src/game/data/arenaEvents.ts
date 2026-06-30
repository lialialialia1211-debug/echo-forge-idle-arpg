import type { ArenaEventDef } from "../engine/topTypes";

export const arenaEvents: ArenaEventDef[] = [
  {
    id: "arena_event_shattered_lanes",
    displayName: "Shattered Lanes",
    minTier: 1,
    weight: 100,
    logText: "Shattered lanes expose more part caches.",
    enemyIntegrityMultiplier: 1.06,
    playerDriftMultiplier: 0.94,
    rewardQuantity: 0.12,
    rewardBias: [{ target: "weightDisk", weight: 1.6 }],
  },
  {
    id: "arena_event_magnet_storm",
    displayName: "Magnet Storm",
    minTier: 1,
    weight: 88,
    logText: "Magnet storm pulls fast rivals into sharper collisions.",
    enemyRpmMultiplier: 1.12,
    enemyImpactMultiplier: 1.06,
    rewardRarity: 0.08,
    rewardBias: [{ target: "seal", weight: 1.45 }],
  },
  {
    id: "arena_event_furnace_pressure",
    displayName: "Furnace Pressure",
    minTier: 2,
    weight: 78,
    logText: "Furnace pressure hardens enemies and improves engraved drops.",
    enemyGuardMultiplier: 1.12,
    enemyIntegrityMultiplier: 1.08,
    rewardRarity: 0.12,
    rewardBias: [{ target: "core", weight: 1.5 }],
  },
  {
    id: "arena_event_echo_cache",
    displayName: "Echo Cache",
    minTier: 2,
    weight: 70,
    logText: "Echo caches hum under the circuit floor.",
    enemyIntegrityMultiplier: 1.04,
    rewardQuantity: 0.08,
    rewardRarity: 0.1,
    rewardBias: [
      { target: "circuitChip", weight: 1.8 },
      { target: "forgeMedia", weight: 1.4 },
    ],
  },
  {
    id: "arena_event_judicator_signal",
    displayName: "Judicator Signal",
    minTier: 3,
    weight: 48,
    logText: "The Brass Judicator signal amplifies risk and boss fragments.",
    enemyIntegrityMultiplier: 1.12,
    enemyImpactMultiplier: 1.1,
    enemyRpmMultiplier: 1.08,
    rewardQuantity: 0.1,
    rewardRarity: 0.16,
    rewardBias: [{ target: "bossFragment", weight: 2 }],
  },
];

export function getArenaEventDef(eventId: string): ArenaEventDef {
  const event = arenaEvents.find((entry) => entry.id === eventId);
  if (!event) {
    throw new Error(`Unknown arena event: ${eventId}`);
  }
  return event;
}
