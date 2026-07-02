import type { ArenaAnomalyDef } from "../engine/topTypes";

export const arenaAnomalies: ArenaAnomalyDef[] = [
  {
    id: "anomaly_glass_hail",
    displayName: "Glass Hail",
    description: "Shard storms make control routes sharper while biasing drops toward better rolls.",
    minTier: 2,
    enemyIntegrityMultiplier: 1.14,
    enemyImpactMultiplier: 1.08,
    rewardQuantity: 0.12,
    rewardRarity: 0.22,
  },
  {
    id: "anomaly_ember_backdraft",
    displayName: "Ember Backdraft",
    description: "Heat wakes trail behind enemy tops, raising impact pressure for denser salvage.",
    minTier: 3,
    enemyIntegrityMultiplier: 1.1,
    enemyImpactMultiplier: 1.2,
    rewardQuantity: 0.2,
    rewardRarity: 0.08,
  },
  {
    id: "anomaly_flux_monsoon",
    displayName: "Flux Monsoon",
    description: "The basin overcharges every rival, but route rewards become richer.",
    minTier: 2,
    enemyIntegrityMultiplier: 1.22,
    enemyImpactMultiplier: 1.16,
    rewardQuantity: 0.22,
    rewardRarity: 0.16,
    requiredBossGateId: "boss_gate_brass_judicator",
  },
  {
    id: "anomaly_static_overload",
    displayName: "Static Overload",
    description: "Every clash carries an unstable charge, stretching storm routes into higher-value duels.",
    minTier: 3,
    enemyIntegrityMultiplier: 1.18,
    enemyImpactMultiplier: 1.24,
    rewardQuantity: 0.14,
    rewardRarity: 0.24,
    requiredBossGateId: "boss_gate_brass_judicator",
  },
  {
    id: "anomaly_void_lens",
    displayName: "Void Lens",
    description: "Late network rings bend inward, making enemies harder to crack but more generous.",
    minTier: 3,
    enemyIntegrityMultiplier: 1.28,
    enemyImpactMultiplier: 1.12,
    rewardQuantity: 0.28,
    rewardRarity: 0.18,
    requiredBossGateId: "boss_gate_brass_judicator",
  },
];

export function getArenaAnomalyDef(anomalyId: string): ArenaAnomalyDef {
  const anomaly = arenaAnomalies.find((entry) => entry.id === anomalyId);
  if (!anomaly) {
    throw new Error(`Unknown arena anomaly: ${anomalyId}`);
  }
  return anomaly;
}
