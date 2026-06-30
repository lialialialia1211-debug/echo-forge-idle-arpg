import type { BossGateDef } from "../engine/topTypes";

export const bossGates: BossGateDef[] = [
  {
    id: "boss_gate_brass_judicator",
    displayName: "Brass Judicator",
    arenaId: "arena_red_chancel_disk",
    tier: 3,
    bossIntegrity: 5400,
    requiredDps: 420,
    requiredTracking: 650,
    requiredGuard: 340,
    requiredDrift: 320,
    requiredGrip: 0.42,
    requiredResistance: {
      impact: 0.04,
      heat: 0.16,
      static: 0.08,
    },
    rewardUnlocks: ["arena_key_tier_2", "forge_add_engraving", "circuit_network_seed"],
  },
];

export function getBossGateDef(gateId: string): BossGateDef {
  const gate = bossGates.find((entry) => entry.id === gateId);
  if (!gate) {
    throw new Error(`Unknown boss gate: ${gateId}`);
  }
  return gate;
}
