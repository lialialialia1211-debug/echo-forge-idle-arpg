import type { ArenaAnomalyDef } from "../engine/topTypes";

export const arenaAnomalies: ArenaAnomalyDef[] = [
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
];

export function getArenaAnomalyDef(anomalyId: string): ArenaAnomalyDef {
  const anomaly = arenaAnomalies.find((entry) => entry.id === anomalyId);
  if (!anomaly) {
    throw new Error(`Unknown arena anomaly: ${anomalyId}`);
  }
  return anomaly;
}
